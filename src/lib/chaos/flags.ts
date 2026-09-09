import "server-only";
import { redis } from "@/lib/redis";

/**
 * Chaos Engine (Fase 8) — flags de injeção de falha, só para desenvolvimento
 * e demonstração. `isProduction()` é checado em CADA leitura, não só na
 * borda da UI — mesmo que alguém consiga escrever a flag no Redis de
 * produção por engano, todo `isChaosActive` retorna `false`
 * incondicionalmente lá. Isso é intencional e redundante com o gate de
 * `NODE_ENV` nas próprias rotas que expõem o toggle (ver
 * `/api/dev/chaos/route.ts`) — um recurso que simula "Redis fora do ar" tem
 * que ser impossível de acionar em produção por qualquer caminho.
 */
export type ChaosFlag = "redisDown" | "queueStalled" | "workerSlow" | "timeout" | "webhookFailure";

export const CHAOS_FLAGS: ChaosFlag[] = ["redisDown", "queueStalled", "workerSlow", "timeout", "webhookFailure"];

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function chaosKey(flag: ChaosFlag) {
  return `chaos:v1:${flag}`;
}

// Fallback em memória para quando o Redis REST não está configurado — o
// Chaos Mode ainda precisa funcionar em dev local sem Upstash.
const memoryFlags = new Set<ChaosFlag>();

export async function isChaosActive(flag: ChaosFlag): Promise<boolean> {
  if (isProduction()) return false;
  if (!redis) return memoryFlags.has(flag);
  try {
    const value = await redis.get<string>(chaosKey(flag));
    return value === "1";
  } catch {
    return memoryFlags.has(flag);
  }
}

export async function setChaosFlag(flag: ChaosFlag, active: boolean): Promise<void> {
  if (isProduction()) return; // silencioso — nunca um erro que vaze detalhe de infraestrutura
  if (active) memoryFlags.add(flag);
  else memoryFlags.delete(flag);

  if (!redis) return;
  try {
    if (active) await redis.set(chaosKey(flag), "1", { ex: 60 * 30 }); // auto-expira em 30min — chaos nunca fica ligado esquecido
    else await redis.del(chaosKey(flag));
  } catch {
    // já aplicado em memória acima — silencioso
  }
}

export async function getAllChaosFlags(): Promise<Record<ChaosFlag, boolean>> {
  const entries = await Promise.all(CHAOS_FLAGS.map(async (flag) => [flag, await isChaosActive(flag)] as const));
  return Object.fromEntries(entries) as Record<ChaosFlag, boolean>;
}
