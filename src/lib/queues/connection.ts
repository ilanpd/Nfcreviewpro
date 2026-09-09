import IORedis from "ioredis";

/**
 * Queue Engine (Fase 8) — BullMQ exige um cliente `ioredis` com conexão TCP
 * real ao protocolo Redis; o `@upstash/redis` já usado pelo cache/rate
 * limit (`lib/redis.ts`) é um cliente REST, e os dois não são
 * intercambiáveis. `REDIS_URL` é uma variável de ambiente nova e
 * independente — ausente, o Queue Engine inteiro desliga sozinho (toda
 * `Queue`/`Worker` deste módulo vira `null`), e o Event Bus detecta isso e
 * para de tentar enfileirar (mas continua gravando em `EventLog`,
 * durável). Nenhuma funcionalidade crítica depende de filas existirem. Ver
 * ADR-032/ADR-033.
 */
declare global {
  var queueRedisGlobal: IORedis | null | undefined;
}

function createQueueConnection(): IORedis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  // maxRetriesPerRequest: null é exigido pelo BullMQ — sem isso, o cliente
  // ioredis desiste de comandos de bloqueio (usados internamente pelas
  // filas) cedo demais, corrompendo o comportamento do Worker.
  return new IORedis(url, { maxRetriesPerRequest: null, lazyConnect: true });
}

export const queueRedis = globalThis.queueRedisGlobal ?? createQueueConnection();

if (process.env.NODE_ENV !== "production") {
  globalThis.queueRedisGlobal = queueRedis;
}

export function isQueueEngineAvailable(): boolean {
  return queueRedis !== null;
}
