import { redis } from "@/lib/redis";
import type { QueueName } from "@/lib/queues/definitions";

/**
 * Worker Engine (Fase 8) — cada worker (persistente ou o de dreno
 * serverless) grava um heartbeat a cada ciclo. O Centro de Confiabilidade
 * marca um worker como "parado" quando o heartbeat está mais velho que
 * `STALE_AFTER_MS` — o único jeito honesto de saber se um worker está
 * processando de verdade, já que BullMQ não expõe isso diretamente (só o
 * estado das filas, não se algo está do outro lado consumindo).
 */
const STALE_AFTER_MS = 2 * 60_000;
const TTL_SECONDS = 300;

function heartbeatKey(queueName: QueueName) {
  return `worker-heartbeat:v1:${queueName}`;
}

export async function recordHeartbeat(queueName: QueueName): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(heartbeatKey(queueName), Date.now(), { ex: TTL_SECONDS });
  } catch {
    // best-effort — a ausência de heartbeat já é, por si só, o sinal correto de "worker indisponível"
  }
}

export async function getWorkerHealth(): Promise<Record<QueueName, { lastSeenAt: number | null; healthy: boolean }>> {
  const { QUEUE_NAMES } = await import("@/lib/queues/definitions");
  const entries = await Promise.all(
    QUEUE_NAMES.map(async (name) => {
      if (!redis) return [name, { lastSeenAt: null, healthy: false }] as const;
      try {
        const lastSeenAt = await redis.get<number>(heartbeatKey(name));
        const healthy = lastSeenAt !== null && Date.now() - lastSeenAt < STALE_AFTER_MS;
        return [name, { lastSeenAt: lastSeenAt ?? null, healthy }] as const;
      } catch {
        return [name, { lastSeenAt: null, healthy: false }] as const;
      }
    })
  );
  return Object.fromEntries(entries) as Record<QueueName, { lastSeenAt: number | null; healthy: boolean }>;
}
