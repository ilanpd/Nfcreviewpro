import "server-only";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { queueRedis, isQueueEngineAvailable } from "@/lib/queues/connection";
import { QUEUE_NAMES, getQueue, getDeadQueue, type QueueName } from "@/lib/queues/definitions";
import { getWorkerHealth } from "@/lib/workers/heartbeat";
import { getCacheMetrics } from "@/lib/observability/cache-metrics";
import { getSseConnectionCount } from "@/lib/observability/sse-metrics";
import { getRecentSpanCount } from "@/lib/observability/trace-metrics";
import { getAllChaosFlags } from "@/lib/chaos/flags";
import type { DomainEventType } from "@/domain/events/types";

/**
 * Reliability Engine (Fase 8) — o serviço por trás do Painel de Saúde em
 * `/dev/ceo/reliability` e do Mission Control. Cada sub-leitura já degrada
 * graciosamente sozinha (ver os módulos importados); este arquivo só agrega
 * o resultado, nunca lança — uma falha ao consultar UMA fonte (ex.: Postgres
 * fora do ar) não pode impedir de mostrar as outras. Ver ADR-032/033.
 */

export interface QueueHealthSummary {
  name: QueueName;
  available: boolean;
  counts: { waiting: number; active: number; completed: number; failed: number; delayed: number } | null;
  deadLetterCount: number | null;
  worker: { lastSeenAt: number | null; healthy: boolean };
}

export interface RedisHealthSummary {
  restConfigured: boolean;
  restHealthy: boolean | null;
  queueConfigured: boolean;
  queueHealthy: boolean | null;
}

export interface EventThroughputSummary {
  lastMinute: number;
  last5Minutes: number;
  byType: { type: DomainEventType | string; count: number }[];
}

export interface ReliabilitySnapshot {
  redis: RedisHealthSummary;
  queues: QueueHealthSummary[];
  events: EventThroughputSummary;
  cache: { namespace: string; hits: number; misses: number; hitRate: number | null }[];
  sseConnections: number | null;
  recentSpanCount: number | null;
  chaos: Record<string, boolean>;
  overallHealthy: boolean;
}

async function getRedisHealth(): Promise<RedisHealthSummary> {
  const restConfigured = redis !== null;
  const queueConfigured = isQueueEngineAvailable();

  const [restHealthy, queueHealthy] = await Promise.all([
    restConfigured
      ? redis!
          .ping()
          .then(() => true)
          .catch(() => false)
      : Promise.resolve(null),
    queueConfigured
      ? queueRedis!
          .ping()
          .then(() => true)
          .catch(() => false)
      : Promise.resolve(null),
  ]);

  return { restConfigured, restHealthy, queueConfigured, queueHealthy };
}

async function getQueueHealthSummaries(): Promise<QueueHealthSummary[]> {
  const workerHealth = await getWorkerHealth();
  const available = isQueueEngineAvailable();

  return Promise.all(
    QUEUE_NAMES.map(async (name) => {
      if (!available) {
        return { name, available: false, counts: null, deadLetterCount: null, worker: workerHealth[name] };
      }
      try {
        const queue = getQueue(name);
        const dead = getDeadQueue(name);
        const [counts, deadCounts] = await Promise.all([
          queue!.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
          dead!.getJobCounts("waiting"),
        ]);
        return {
          name,
          available: true,
          counts: {
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            delayed: counts.delayed ?? 0,
          },
          deadLetterCount: deadCounts.waiting ?? 0,
          worker: workerHealth[name],
        };
      } catch {
        return { name, available: false, counts: null, deadLetterCount: null, worker: workerHealth[name] };
      }
    })
  );
}

async function getEventThroughput(): Promise<EventThroughputSummary> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000);

  try {
    const [lastMinute, last5Minutes, grouped] = await Promise.all([
      prisma.eventLog.count({ where: { createdAt: { gte: oneMinuteAgo } } }),
      prisma.eventLog.count({ where: { createdAt: { gte: fiveMinutesAgo } } }),
      prisma.eventLog.groupBy({
        by: ["type"],
        where: { createdAt: { gte: fiveMinutesAgo } },
        _count: { type: true },
        orderBy: { _count: { type: "desc" } },
      }),
    ]);

    return {
      lastMinute,
      last5Minutes,
      byType: grouped.map((g) => ({ type: g.type, count: g._count.type })),
    };
  } catch {
    // Postgres indisponível — o painel mostra zeros em vez de quebrar a
    // página inteira; o card de "Redis"/"Queues" acima ainda é útil sozinho.
    return { lastMinute: 0, last5Minutes: 0, byType: [] };
  }
}

export async function getReliabilitySnapshot(): Promise<ReliabilitySnapshot> {
  const [redisHealth, queues, events, resolutionCache, analyticsCache, sseConnections, recentSpanCount, chaos] = await Promise.all([
    getRedisHealth(),
    getQueueHealthSummaries(),
    getEventThroughput(),
    getCacheMetrics("resolution"),
    getCacheMetrics("analytics"),
    getSseConnectionCount(),
    getRecentSpanCount(),
    getAllChaosFlags(),
  ]);

  // "Saudável" no todo = nenhum sinal vermelho conhecido. Redis/filas
  // ausentes (não configurados) não contam como não-saudável — é um modo de
  // operação válido e degradado com honestidade, não uma falha.
  const overallHealthy =
    (redisHealth.restConfigured ? redisHealth.restHealthy !== false : true) &&
    (redisHealth.queueConfigured ? redisHealth.queueHealthy !== false : true) &&
    queues.every((q) => !q.available || q.worker.healthy || (q.counts?.waiting ?? 0) === 0);

  return {
    redis: redisHealth,
    queues,
    events,
    cache: [
      { namespace: "resolution", ...resolutionCache },
      { namespace: "analytics", ...analyticsCache },
    ],
    sseConnections,
    recentSpanCount,
    chaos,
    overallHealthy,
  };
}
