import { redis } from "@/lib/redis";

/**
 * Observability Engine (Fase 8) — contador de conexões SSE ativas
 * (`/api/live/stream`). Incrementado quando uma conexão abre, decrementado
 * quando fecha (cancelamento do cliente ou o auto-close de
 * `MAX_CONNECTION_MS` — ver a própria rota). Sem Redis configurado, o
 * Centro de Confiabilidade mostra "desconhecido" em vez de inventar um
 * número — mesmo padrão de honestidade de `cache-metrics.ts`.
 */
const KEY = "sse-metrics:v1:active-connections";

export function incrementSseConnections(): void {
  if (!redis) return;
  redis.incr(KEY).catch(() => {});
}

export function decrementSseConnections(): void {
  if (!redis) return;
  redis.decr(KEY).catch(() => {});
}

export async function getSseConnectionCount(): Promise<number | null> {
  if (!redis) return null;
  try {
    const value = await redis.get<number>(KEY);
    // Nunca reporta negativo — um decrement duplicado (ex.: cancel() chamado
    // depois do auto-close já ter decrementado) não deve virar um número
    // sem sentido na tela.
    return Math.max(0, value ?? 0);
  } catch {
    return null;
  }
}
