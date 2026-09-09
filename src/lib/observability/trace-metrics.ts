import { redis } from "@/lib/redis";

/**
 * Observability Engine (Fase 8) — contador de spans recentes, para o
 * Mission Control mostrar atividade de tracing sem inventar um "traces
 * ativos" que o `ConsoleSpanExporter` não sustenta (ele exporta cada span
 * já FINALIZADO para o log do processo — não existe um registro de spans
 * "em voo" sem um coletor real por trás; ver `tracing.ts`/ADR-034). Isto é
 * honestamente "quantos spans começaram nos últimos ~2 minutos", não
 * "quantas requisições estão em andamento agora".
 */
const BUCKET_TTL_SECONDS = 180;

function bucketKey(epochMinute: number) {
  return `trace-metrics:v1:${epochMinute}`;
}

export function recordSpanStarted(): void {
  if (!redis) return;
  const epochMinute = Math.floor(Date.now() / 60_000);
  const key = bucketKey(epochMinute);
  redis
    .incr(key)
    .then(() => redis!.expire(key, BUCKET_TTL_SECONDS))
    .catch(() => {});
}

export async function getRecentSpanCount(): Promise<number | null> {
  if (!redis) return null;
  try {
    const epochMinute = Math.floor(Date.now() / 60_000);
    const [current, previous] = await Promise.all([
      redis.get<number>(bucketKey(epochMinute)),
      redis.get<number>(bucketKey(epochMinute - 1)),
    ]);
    return (current ?? 0) + (previous ?? 0);
  } catch {
    return null;
  }
}
