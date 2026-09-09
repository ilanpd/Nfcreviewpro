import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCorrelationId, newCorrelationId } from "@/lib/observability/correlation";
import { log } from "@/lib/observability/logger";
import { getQueue } from "@/lib/queues/definitions";
import { rateLimit } from "@/lib/rate-limit";
import { EVENT_SUBSCRIPTIONS } from "./subscriptions";
import type { DomainEvent, DomainEventPayloads, DomainEventType, PublishContext } from "@/domain/events/types";

const EVENT_VERSION = 1;

/**
 * Event Bus (Fase 8) — o único ponto de publicação de um evento de domínio.
 * Nenhum produtor monta o envelope à mão nem conhece filas/consumidores.
 *
 * Ordem de operações, cada uma isolada da outra:
 *   1. Persistir em `EventLog` (Postgres, durável) — a fonte da verdade,
 *      sobrevive mesmo que o Redis/BullMQ esteja fora do ar.
 *   2. Rotear para as filas inscritas (`EVENT_SUBSCRIPTIONS`) — best-effort;
 *      se o Queue Engine não estiver configurado ou uma fila falhar ao
 *      aceitar o job, o evento já está persistido e pode ser reprocessado
 *      depois via Replay (`services/replay.service.ts`).
 *
 * `publishEvent` nunca lança — um problema ao publicar um evento (mesmo o
 * passo 1, o insert no Postgres) é logado, nunca propagado para quem
 * chamou, porque publicar um evento é sempre um efeito colateral de uma
 * ação principal (criar uma campanha, resolver um redirecionamento) que já
 * aconteceu com sucesso — falhar a publicação não deveria desfazer isso
 * nem quebrar a resposta ao usuário. Ver ADR-032.
 */
export async function publishEvent<T extends DomainEventType>(
  type: T,
  payload: DomainEventPayloads[T],
  context: PublishContext = {}
): Promise<void> {
  const correlationId = context.correlationId ?? getCorrelationId() ?? newCorrelationId();
  const event: DomainEvent<T> = {
    id: randomUUID(),
    type,
    version: EVENT_VERSION,
    companyId: context.companyId ?? null,
    organizationId: context.organizationId ?? null,
    correlationId,
    payload,
    occurredAt: new Date(),
  };

  try {
    await prisma.eventLog.create({
      data: {
        id: event.id,
        type: event.type,
        version: event.version,
        companyId: event.companyId,
        organizationId: event.organizationId,
        correlationId: event.correlationId,
        payload: event.payload as object,
        createdAt: event.occurredAt,
      },
    });
  } catch (err) {
    log.error("event-bus", `Falha ao persistir evento "${type}" em EventLog`, { error: String(err), correlationId });
    // Sem o registro durável, ainda tentamos enfileirar — melhor um efeito
    // colateral sem trilha de auditoria do que nenhum efeito colateral.
  }

  await routeToQueues(event);

  log.info("event-bus", `Evento publicado: ${type}`, { eventId: event.id, correlationId, companyId: event.companyId });
}

/**
 * Event Replay (Fase 8) — reenfileira um evento JÁ EXISTENTE em `EventLog`
 * (ex.: gravado enquanto o Queue Engine estava fora do ar) sem criar uma
 * segunda linha de auditoria para o mesmo acontecimento — ao contrário de
 * `publishEvent`, que sempre representa um evento NOVO. Reaproveita o mesmo
 * `id` do evento original como `jobId` (ver `routeToQueues`/`getQueue`), o
 * que dá deduplicação de fila "de graça": se o job original ainda existir
 * na fila (ativo/concluído recente), o BullMQ recusa o duplicado; se já foi
 * removido, ele é reenfileirado, e a claim de idempotência do worker
 * (`claimIdempotencyKey`, TTL de 24h) decide se o efeito colateral deve
 * rodar de novo. Ver `services/replay.service.ts` e ADR-032.
 */
export async function replayExistingEvent(event: DomainEvent): Promise<void> {
  await routeToQueues(event);
  log.info("event-bus", `Evento reenfileirado via Replay: ${event.type}`, { eventId: event.id, correlationId: event.correlationId });
}

async function routeToQueues<T extends DomainEventType>(event: DomainEvent<T>) {
  // Limite por organização (Segurança Operacional, Fase 8) — nunca afeta a
  // gravação em EventLog acima (já concluída) nem o redirecionamento que
  // originou o evento; só protege o Queue Engine compartilhado de uma
  // única organização saturando-o. Um evento "descartado" aqui não é
  // perdido: continua em EventLog e pode ser reenfileirado depois via
  // Event Replay (`replayExistingEvent`) quando o pico passar.
  if (event.companyId) {
    const { success } = await rateLimit("queueRouting", event.companyId);
    if (!success) {
      log.warn("event-bus", `Limite de roteamento de filas excedido para a organização — evento mantido em EventLog, não enfileirado`, {
        eventId: event.id,
        companyId: event.companyId,
        type: event.type,
      });
      return;
    }
  }

  const queueNames = EVENT_SUBSCRIPTIONS[event.type] ?? [];
  for (const queueName of queueNames) {
    const queue = getQueue(queueName);
    if (!queue) continue; // Queue Engine indisponível — degradação graciosa, sem log de erro (é um estado esperado sem REDIS_URL)
    try {
      await queue.add(event.type, event, { jobId: event.id });
    } catch (err) {
      log.error("event-bus", `Falha ao enfileirar evento "${event.type}" em "${queueName}"`, { error: String(err), eventId: event.id });
    }
  }
}
