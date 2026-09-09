import "server-only";
import type { Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/observability/logger";
import { withCorrelation } from "@/lib/observability/correlation";
import { withSpan } from "@/lib/observability/tracing";
import { claimIdempotencyKey } from "@/lib/queues/idempotency";
import { isChaosActive } from "@/lib/chaos/flags";
import { attemptWebhookDelivery } from "@/lib/webhooks/delivery";
import { toPublicWebhookEventType } from "@/domain/api-v1/webhook-events";
import { evaluatePlaybooksForCompany } from "@/services/playbook-engine.service";
import { runScheduledExecution } from "@/services/execution-engine.service";
import type { DomainEvent, DomainEventType } from "@/domain/events/types";
import type { QueueName } from "@/lib/queues/definitions";

/**
 * Worker Engine (Fase 8) — um processador por fila. Cada um:
 *   1. Reivindica a chave de idempotência do evento (pula silenciosamente
 *      se já processado — uma reentrega do BullMQ ou um Replay de Eventos
 *      não deveria repetir um efeito colateral externo).
 *   2. Roda dentro de um contexto de correlação (o mesmo Correlation ID do
 *      evento original) e de um span de tracing.
 *
 * `whatsapp` e `emails` são deliberadamente stubs honestos — este produto
 * não tem uma integração real com a API do WhatsApp Business nem com um
 * provedor de e-mail (Resend, SendGrid, etc.) configurada em nenhuma fase
 * anterior. Fingir o envio seria inventar uma capacidade que não existe;
 * os processadores logam exatamente o que seria enviado, prontos para
 * receber a integração real no dia em que ela existir. Ver ADR-033.
 */

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function maybeApplyChaos(scope: "worker" | "webhook") {
  if (process.env.NODE_ENV === "production") return;
  if (await isChaosActive("workerSlow")) await delay(4000);
  if (scope === "webhook" && (await isChaosActive("timeout"))) await delay(60_000);
  if (scope === "webhook" && (await isChaosActive("webhookFailure"))) {
    throw new Error("Chaos Mode: falha de webhook simulada");
  }
}

function processEvent<T extends DomainEventType>(name: string, handler: (event: DomainEvent<T>, job: Job) => Promise<void>) {
  return async (job: Job<DomainEvent<T>>) => {
    const event = job.data;
    return withCorrelation(async () => {
      const isFirstAttempt = await claimIdempotencyKey(`${name}:${event.id}`);
      if (!isFirstAttempt) {
        log.info(name, `Job já processado, pulando (idempotência)`, { eventId: event.id });
        return;
      }
      await withSpan(`worker.${name}`, () => handler(event, job), { eventType: event.type, eventId: event.id });
    }, event.correlationId);
  };
}

export const analyticsProcessor = processEvent("analytics", async (event) => {
  await maybeApplyChaos("worker");
  // Analytics hoje é "pull" (calculado sob demanda, com cache curto — ver
  // Fase 7), não "push". Este processador é o ponto de extensão natural
  // para pré-aquecer esse cache quando o volume justificar — por ora,
  // registra a passagem do evento pela fila, provando o pipeline real.
  log.info("analytics-worker", `Processado: ${event.type}`, { eventId: event.id, companyId: event.companyId });
});

export const whatsappProcessor = processEvent("whatsapp", async (event) => {
  await maybeApplyChaos("worker");
  log.info("whatsapp-worker", `[stub] Mensagem de WhatsApp seria enviada para o evento ${event.type}`, {
    eventId: event.id,
    companyId: event.companyId,
    aviso: "Nenhuma integração real com a API do WhatsApp Business está configurada neste produto.",
  });
});

export const emailsProcessor = processEvent("emails", async (event) => {
  await maybeApplyChaos("worker");
  log.info("emails-worker", `[stub] E-mail seria enviado para o evento ${event.type}`, {
    eventId: event.id,
    companyId: event.companyId,
    aviso: "Nenhum provedor de e-mail (Resend/SendGrid/etc.) está configurado neste produto.",
  });
});

export const exportsProcessor = processEvent("exports", async (event) => {
  await maybeApplyChaos("worker");
  log.info("exports-worker", `Processado: ${event.type}`, { eventId: event.id });
});

export const heavyProcessor = processEvent("heavy", async (event) => {
  await maybeApplyChaos("worker");
  log.info("heavy-worker", `Processado: ${event.type}`, { eventId: event.id });
});

/**
 * Webhooks Enterprise (Fase 9) — entrega para todo `WebhookEndpoint` ativo
 * da empresa inscrito no nome PÚBLICO deste evento (ver
 * `domain/api-v1/webhook-events.ts`; um evento sem nome público, como
 * ZonaAtualizada/MesaAtualizada hoje, nunca chega aqui a ponto de entregar).
 * A entrega em si (assinatura HMAC, Circuit Breaker por endpoint, gravação
 * do resultado) vive em `lib/webhooks/delivery.ts` — a mesma função que o
 * replay manual do Dashboard de Desenvolvedor usa. Uma linha de
 * `WebhookDelivery` por (endpoint, evento) faz o reenvio do BullMQ após uma
 * falha PARCIAL (2 de 3 endpoints entregues, 1 falhou) seguro: o retry pula
 * os que já tiveram sucesso via a constraint única
 * `@@unique([endpointId, eventId])`, tentando de novo só o que falhou.
 */
export const webhooksProcessor = processEvent("webhooks", async (event, job) => {
  if (!event.companyId) return;

  const publicEventType = toPublicWebhookEventType(event.type);
  if (!publicEventType) return; // evento sem contrato público ainda — nada a entregar

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { companyId: event.companyId, active: true, events: { has: publicEventType } },
  });
  if (endpoints.length === 0) return; // ninguém assinou este evento — não é uma falha

  const attemptsMade = job.attemptsMade ?? 0;
  const maxAttempts = job.opts.attempts ?? 5;
  const isLastAttempt = attemptsMade + 1 >= maxAttempts;
  const failures: string[] = [];

  for (const endpoint of endpoints) {
    const existing = await prisma.webhookDelivery.upsert({
      where: { endpointId_eventId: { endpointId: endpoint.id, eventId: event.id } },
      update: {},
      create: { endpointId: endpoint.id, eventId: event.id, eventType: publicEventType, payload: event as object },
    });
    if (existing.status === "SUCCESS") continue; // já entregue numa tentativa anterior deste mesmo job

    try {
      await attemptWebhookDelivery(endpoint, existing, { isLastAttempt, onChaos: () => maybeApplyChaos("webhook") });
    } catch {
      failures.push(endpoint.id);
    }
  }

  // Relançar (se algo falhou) é o que faz o BullMQ tentar este job de novo —
  // o loop acima já garante que uma nova tentativa só reprocessa os
  // endpoints que ainda não tiveram sucesso.
  if (failures.length > 0) throw new Error(`Falha ao entregar para ${failures.length} endpoint(s): ${failures.join(", ")}`);
});

/**
 * Playbook Engine (Fase 11) — a fila "playbooks" carrega DOIS formatos de
 * job diferentes, distinguidos pelo nome:
 *   - um `DomainEvent` normal (nome = tipo do evento, ex.: "FeedbackRecebido")
 *     → reavalia os gatilhos de Playbook para a empresa daquele evento;
 *   - `"execute-scheduled-playbook"` (nome fixo, dado = `{ executionId }`)
 *     → o Scheduler Inteligente rodando uma execução agendada/recorrente.
 * Nunca a mesma função `processEvent` genérica dos outros processadores,
 * porque o segundo formato não é um `DomainEvent`.
 */
export const playbooksProcessor = async (job: Job) => {
  await maybeApplyChaos("worker");

  if (job.name === "execute-scheduled-playbook") {
    const { executionId } = job.data as { executionId: string };
    return withCorrelation(() => runScheduledExecution(executionId), executionId);
  }

  const event = job.data as DomainEvent;
  return withCorrelation(async () => {
    const isFirstAttempt = await claimIdempotencyKey(`playbooks:${event.id}`);
    if (!isFirstAttempt) return;
    if (!event.companyId) return;
    await withSpan("worker.playbooks", () => evaluatePlaybooksForCompany(event.companyId!, { fromEvent: true }), {
      eventType: event.type,
      eventId: event.id,
    });
  }, event.correlationId);
};

export const PROCESSORS: Record<QueueName, (job: Job) => Promise<void>> = {
  analytics: analyticsProcessor,
  webhooks: webhooksProcessor,
  whatsapp: whatsappProcessor,
  emails: emailsProcessor,
  exports: exportsProcessor,
  heavy: heavyProcessor,
  playbooks: playbooksProcessor,
};
