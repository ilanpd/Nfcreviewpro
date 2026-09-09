import { redis } from "@/lib/redis";
import { recordCacheEvent } from "@/lib/observability/cache-metrics";

/**
 * Cache genérico para os 5 motores da Fase 7 (Analytics/Insights/Forecast/
 * Ranking/Export Engine) — mesma forma e mesma degradação graciosa do cache
 * do Resolution Engine (`lib/resolution-engine/cache.ts`), mas deliberadamente
 * seu próprio módulo, com seu próprio namespace de chave: "Todos desacoplados"
 * significa que o Analytics Engine não deveria precisar importar nada de
 * dentro do Resolution Engine só para cachear, mesmo que a lógica de
 * cache/degradação seja idêntica. Ver ADR-030.
 *
 * TTL curto (60s por padrão) — o suficiente para uma tela de dashboard não
 * refazer a mesma agregação pesada a cada re-render/troca de aba, sem deixar
 * o Command Center ou o KPI "hoje" perceptivelmente desatualizado.
 */
const DEFAULT_TTL_SECONDS = 60;

export async function analyticsCached<T>(key: string, loader: () => Promise<T>, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<T> {
  const fullKey = `analytics:v1:${key}`;

  if (redis) {
    try {
      const cached = await redis.get<T>(fullKey);
      if (cached !== null && cached !== undefined) {
        recordCacheEvent("analytics", "hit");
        return cached;
      }
      recordCacheEvent("analytics", "miss");
    } catch (err) {
      console.error("[analytics-cache] redis GET failed, falling back to Postgres", err);
    }
  }

  const value = await loader();

  if (redis && value !== null && value !== undefined) {
    redis.set(fullKey, value, { ex: ttlSeconds }).catch((err) => {
      console.error("[analytics-cache] redis SET failed", err);
    });
  }

  return value;
}
