import { redis } from "@/lib/redis";

/**
 * Queue Engine (Fase 8) — deduplicação/idempotência de jobs via
 * `SET ... NX EX` no Redis REST já existente (`lib/redis.ts`) — não precisa
 * do `ioredis`/BullMQ, é a mesma primitiva simples usada pelo rate limiter.
 * Um Worker que processa o mesmo evento duas vezes (reentrega do BullMQ
 * após um crash antes do ACK, ou um Replay de Eventos manual) precisa
 * conseguir perceber isso e pular — sobretudo para o worker de webhooks,
 * onde repetir a chamada externa duas vezes é um efeito colateral real
 * observável pelo cliente.
 *
 * Sem Redis configurado, `claim` sempre retorna `true` (degrada para
 * "processar sempre") — pior que dedup real, mas nunca bloqueia um job por
 * causa de infraestrutura de apoio indisponível.
 */
const TTL_SECONDS = 60 * 60 * 24; // 24h — mais que suficiente para cobrir reentregas do BullMQ

/** `true` se este é o primeiro processamento desta chave (deve prosseguir);
 * `false` se já foi processado (deve pular, silenciosamente). */
export async function claimIdempotencyKey(key: string): Promise<boolean> {
  if (!redis) return true;
  try {
    const result = await redis.set(`idempotency:v1:${key}`, "1", { nx: true, ex: TTL_SECONDS });
    return result !== null;
  } catch (err) {
    console.error("[idempotency] redis SET NX falhou — processando mesmo assim", err);
    return true;
  }
}
