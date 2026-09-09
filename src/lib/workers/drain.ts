import "server-only";
import { Worker } from "bullmq";
import { queueRedis, isQueueEngineAvailable } from "@/lib/queues/connection";
import { QUEUE_NAMES } from "@/lib/queues/definitions";
import { PROCESSORS } from "./processors";
import { recordHeartbeat } from "./heartbeat";
import { log } from "@/lib/observability/logger";
import { isChaosActive } from "@/lib/chaos/flags";

const HEARTBEAT_INTERVAL_MS = 5000;

/**
 * Worker Engine (Fase 8) — o padrão que faz filas funcionarem de verdade
 * num alvo serverless (Vercel): BullMQ exige um `Worker` de longa duração
 * escutando Redis, e uma function serverless não sustenta isso entre
 * invocações — o mesmo problema, e a mesma solução em espírito, do
 * WebSocket vs. SSE do ADR-025. Aqui, um `Worker` de vida curta processa o
 * que houver disponível por até `maxDurationMs`, então se fecha —
 * disparado por `/api/queues/process`, que o Vercel Cron aciona
 * periodicamente. Para uma implantação sempre-ligada de verdade (fora da
 * Vercel), `run-workers.ts` inicia os mesmos processadores como um
 * processo Node persistente, sem esse limite de tempo. Ver ADR-033.
 */
export async function drainQueuesForDuration(maxDurationMs: number): Promise<{ processed: number; queues: string[]; skipped?: string }> {
  if (!isQueueEngineAvailable()) {
    return { processed: 0, queues: [], skipped: "Queue Engine indisponível (REDIS_URL não configurado)" };
  }

  if (process.env.NODE_ENV !== "production" && (await isChaosActive("queueStalled"))) {
    log.warn("worker-engine", "Chaos Mode: queueStalled ativo — dreno recusado deliberadamente para simular um worker travado");
    return { processed: 0, queues: [], skipped: "Chaos Mode: queueStalled ativo" };
  }

  let processed = 0;
  const workers = QUEUE_NAMES.map(
    (name) =>
      new Worker(
        name,
        async (job) => {
          await PROCESSORS[name](job);
          processed += 1;
        },
        { connection: queueRedis!, concurrency: 5 }
      )
  );

  const heartbeatInterval = setInterval(() => {
    for (const name of QUEUE_NAMES) recordHeartbeat(name);
  }, HEARTBEAT_INTERVAL_MS);
  for (const name of QUEUE_NAMES) await recordHeartbeat(name);

  await new Promise((resolve) => setTimeout(resolve, maxDurationMs));

  clearInterval(heartbeatInterval);
  await Promise.all(workers.map((w) => w.close()));

  log.info("worker-engine", `Dreno concluído: ${processed} job(s) processado(s)`, { queues: QUEUE_NAMES });
  return { processed, queues: QUEUE_NAMES };
}
