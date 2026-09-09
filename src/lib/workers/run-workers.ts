/**
 * Worker Engine (Fase 8) — entrypoint para uma implantação sempre-ligada de
 * verdade (Railway/Fly.io/uma VM pequena — não a Vercel), quando o volume
 * de jobs justificar um processo dedicado em vez do dreno serverless via
 * `/api/queues/process`. Fica vivo até receber SIGINT/SIGTERM, fechando os
 * Workers de forma graciosa.
 *
 * Usa os aliases `@/*` normais do projeto (consistente com o resto do
 * código-fonte) — rodar isto fora do build do Next (`npx tsx` puro) NÃO
 * resolve `@/*` sozinho; é preciso `tsconfig-paths`
 * (`npm i -D tsconfig-paths` e `node -r tsconfig-paths/register -r tsx/cjs
 * src/lib/workers/run-workers.ts`), ou compilar este arquivo como parte de
 * um passo de build que já resolve o alias (ex.: `tsc` com
 * `moduleResolution`/`paths` configurados, ou um bundle do próprio Next).
 * Documentado aqui em vez de reescrever toda a árvore de módulos que este
 * arquivo importa com imports relativos só para esta única forma de rodar
 * — ver ADR-033.
 */
import { Worker } from "bullmq";
import { queueRedis, isQueueEngineAvailable } from "@/lib/queues/connection";
import { QUEUE_NAMES } from "@/lib/queues/definitions";
import { PROCESSORS } from "@/lib/workers/processors";
import { recordHeartbeat } from "@/lib/workers/heartbeat";

async function main() {
  if (!isQueueEngineAvailable()) {
    console.error("REDIS_URL não configurado — o Worker Engine não tem o que consumir. Encerrando.");
    process.exitCode = 1;
    return;
  }

  console.log(`Iniciando Worker Engine para as filas: ${QUEUE_NAMES.join(", ")}`);

  const workers = QUEUE_NAMES.map(
    (name) => new Worker(name, async (job) => PROCESSORS[name](job), { connection: queueRedis!, concurrency: 5 })
  );

  const heartbeatInterval = setInterval(() => {
    for (const name of QUEUE_NAMES) recordHeartbeat(name);
  }, 5000);

  async function shutdown() {
    console.log("Encerrando Worker Engine...");
    clearInterval(heartbeatInterval);
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Worker Engine falhou ao iniciar", err);
  process.exitCode = 1;
});
