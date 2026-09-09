import "server-only";
import { prisma } from "@/lib/prisma";

/** Alimenta o painel "Logs" do Dashboard de Desenvolvedor com chamadas
 * reais à API pública v1 — nunca dados fabricados. Ver `lib/api-v1/request-log.ts`
 * (quem grava) e `ApiRequestLog` no schema. */
export function listApiRequestLogs(companyId: string, cursor?: string, limit = 20) {
  return prisma.apiRequestLog.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export async function getApiUsageSummary(companyId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [last24h, avgLatency] = await Promise.all([
    prisma.apiRequestLog.count({ where: { companyId, createdAt: { gte: since } } }),
    prisma.apiRequestLog.aggregate({ where: { companyId, createdAt: { gte: since } }, _avg: { latencyMs: true } }),
  ]);
  return { requestsLast24h: last24h, avgLatencyMs: avgLatency._avg.latencyMs ? Math.round(avgLatency._avg.latencyMs) : null };
}
