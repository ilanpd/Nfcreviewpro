import { redis } from "@/lib/redis";
import { PIN_ATTEMPT_WINDOW_MS } from "@/domain/return-offer/pin";

/**
 * Falhas de PIN por escopo (ADR-079): uma lista de instantes por brinde e outra
 * por empresa, em Redis com validade de um pouco mais que a janela. A regra de
 * quantas falhas cabem é do domínio (`evaluatePinAttempts`); aqui só se guarda
 * e se lê. Sem Redis (desenvolvimento), cai para a memória do processo, com a
 * mesma semântica e garantia mais fraca, como o resto de `lib/rate-limit.ts`.
 */

const TTL_SECONDS = Math.ceil(PIN_ATTEMPT_WINDOW_MS / 1000) + 60;
const memory = new Map<string, number[]>();

function key(scope: string) {
  return `pinfail:${scope}`;
}

function memoryRead(scope: string, now: number): number[] {
  const kept = (memory.get(key(scope)) ?? []).filter((t) => t > now - PIN_ATTEMPT_WINDOW_MS);
  memory.set(key(scope), kept);
  return kept;
}

export async function getPinFailures(scope: string, now = new Date()): Promise<Date[]> {
  if (redis) {
    try {
      const raw = await redis.lrange<number>(key(scope), 0, -1);
      return raw.map((t) => new Date(Number(t)));
    } catch (err) {
      console.error("[pin-failures] Redis falhou na leitura, usando memória", err);
    }
  }
  return memoryRead(scope, now.getTime()).map((t) => new Date(t));
}

export async function addPinFailure(scope: string, now = new Date()): Promise<void> {
  if (redis) {
    try {
      await redis.rpush(key(scope), now.getTime());
      await redis.expire(key(scope), TTL_SECONDS);
      return;
    } catch (err) {
      console.error("[pin-failures] Redis falhou na gravação, usando memória", err);
    }
  }
  memoryRead(scope, now.getTime());
  memory.get(key(scope))!.push(now.getTime());
}

/** Depois de um resgate bem-sucedido as falhas daquele brinde deixam de valer. */
export async function clearPinFailures(scope: string): Promise<void> {
  memory.delete(key(scope));
  if (redis) {
    try {
      await redis.del(key(scope));
    } catch (err) {
      console.error("[pin-failures] Redis falhou ao limpar", err);
    }
  }
}
