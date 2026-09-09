import { redis } from "@/lib/redis";

/**
 * Cache Enterprise (Fase 8) — hit/miss por namespace de cache
 * ("resolution", "analytics"), para o Centro de Confiabilidade mostrar uma
 * taxa de acerto real, não estimada. Incrementos são disparados sem
 * `await` nos pontos de leitura de cache (nunca soma latência ao caminho
 * crítico) e falham silenciosamente sem Redis — métrica é sempre
 * best-effort, nunca uma causa de falha real.
 */
export function recordCacheEvent(namespace: string, kind: "hit" | "miss"): void {
  if (!redis) return;
  redis.incr(`cache-metrics:v1:${namespace}:${kind}`).catch(() => {});
}

export async function getCacheMetrics(namespace: string): Promise<{ hits: number; misses: number; hitRate: number | null }> {
  if (!redis) return { hits: 0, misses: 0, hitRate: null };
  try {
    const [hits, misses] = await Promise.all([
      redis.get<number>(`cache-metrics:v1:${namespace}:hit`),
      redis.get<number>(`cache-metrics:v1:${namespace}:miss`),
    ]);
    const h = hits ?? 0;
    const m = misses ?? 0;
    return { hits: h, misses: m, hitRate: h + m > 0 ? h / (h + m) : null };
  } catch {
    return { hits: 0, misses: 0, hitRate: null };
  }
}
