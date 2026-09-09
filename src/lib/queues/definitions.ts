import "server-only";
import { Queue, QueueEvents } from "bullmq";
import { queueRedis, isQueueEngineAvailable } from "./connection";
import { log } from "@/lib/observability/logger";

/**
 * Queue Engine (Fase 8) — 6 filas pedidas, cada uma com retry/backoff
 * exponencial configurado. O BullMQ não tem um conceito nativo de "dead-
 * letter queue" separado (jobs que esgotam `attempts` ficam no estado
 * "failed" da própria fila, recuperáveis via `queue.getFailed()`) — mas
 * para dar uma fila de fato dedicada e mais fácil de inspecionar/repetir
 * (o que foi pedido explicitamente), um listener de `QueueEvents` em modo
 * "failed" mais o número de tentativas esgotado empurra o job para uma
 * fila `<nome>-dead` própria. Ver ADR-033.
 */
// "playbooks" (Fase 11) — avaliação de gatilhos de Playbook disparada por
// eventos de comportamento real do cliente (nunca por um evento que o
// próprio motor de playbooks produziu, ver ADR-050) e execução agendada
// (Scheduler Inteligente: "executar depois"/"repetir" via `delay`/`repeat`
// nativos do BullMQ, sem infraestrutura nova).
export type QueueName = "analytics" | "webhooks" | "whatsapp" | "emails" | "exports" | "heavy" | "playbooks";

export const QUEUE_NAMES: QueueName[] = ["analytics", "webhooks", "whatsapp", "emails", "exports", "heavy", "playbooks"];

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
};

const queues = new Map<QueueName, Queue>();
const deadQueues = new Map<QueueName, Queue>();
const queueEvents = new Map<QueueName, QueueEvents>();

function deadQueueName(name: QueueName) {
  return `${name}-dead`;
}

/** `null` quando `REDIS_URL` não está configurado — todo chamador precisa
 * checar isso e degradar (ver `event-bus/publish.ts`), nunca presumir que
 * enfileirar sempre funciona. */
export function getQueue(name: QueueName): Queue | null {
  if (!isQueueEngineAvailable()) return null;
  if (!queues.has(name)) {
    const queue = new Queue(name, { connection: queueRedis!, defaultJobOptions: DEFAULT_JOB_OPTIONS });
    queues.set(name, queue);
    attachDeadLetterListener(name);
  }
  return queues.get(name)!;
}

export function getDeadQueue(name: QueueName): Queue | null {
  if (!isQueueEngineAvailable()) return null;
  if (!deadQueues.has(name)) {
    deadQueues.set(name, new Queue(deadQueueName(name), { connection: queueRedis! }));
  }
  return deadQueues.get(name)!;
}

function attachDeadLetterListener(name: QueueName) {
  if (queueEvents.has(name)) return;
  const events = new QueueEvents(name, { connection: queueRedis! });
  events.on("failed", async ({ jobId, failedReason }) => {
    try {
      const queue = getQueue(name);
      const job = await queue?.getJob(jobId);
      if (!job) return;
      const attemptsMade = job.attemptsMade ?? 0;
      const attemptsAllowed = job.opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts;
      if (attemptsMade < attemptsAllowed) return; // ainda vai tentar de novo — não é dead-letter ainda

      const dead = getDeadQueue(name);
      await dead?.add("dead-letter", { originalJobId: jobId, name: job.name, data: job.data, failedReason }, { removeOnComplete: false });
      log.error("queue-engine", `Job movido para dead-letter em ${name}`, { jobId, failedReason });
    } catch (err) {
      log.error("queue-engine", `Falha ao processar listener de dead-letter para ${name}`, { error: String(err) });
    }
  });
  queueEvents.set(name, events);
}
