import "server-only";
import { prisma } from "@/lib/prisma";
import type { HeatmapLayer, HeatmapRawCount } from "@/domain/heatmap/types";

/**
 * Uma consulta por camada, cada uma agregando exatamente a tabela que já
 * registra aquele dado — nenhuma tabela nova, nenhum contador duplicado.
 * `CURRENT_CAMPAIGN` não tem uma função aqui de propósito: é servida pelo
 * preview de status do Mapa de Mesas (Fase 5, `domain/table-map/status.ts`),
 * reaproveitado na composição da tela, não recalculado neste serviço — ver
 * ADR-025.
 */

async function countByCard(rows: { cardId: string }[]): Promise<HeatmapRawCount[]> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.cardId, (counts.get(row.cardId) ?? 0) + 1);
  return Array.from(counts.entries()).map(([cardId, count]) => ({ cardId, count }));
}

export async function getApproaches(companyId: string, since: Date): Promise<HeatmapRawCount[]> {
  const rows = await prisma.redirectLog.findMany({ where: { companyId, createdAt: { gte: since } }, select: { cardId: true } });
  return countByCard(rows);
}

export async function getConversions(companyId: string, since: Date): Promise<HeatmapRawCount[]> {
  const rows = await prisma.ratingEvent.findMany({
    where: { companyId, createdAt: { gte: since }, redirectedGoogle: true },
    select: { cardId: true },
  });
  return countByCard(rows);
}

export async function getGoogleReviewsTouches(companyId: string, since: Date): Promise<HeatmapRawCount[]> {
  const [campaignRedirects, legacyGoogle] = await Promise.all([
    prisma.redirectLog.findMany({
      where: { companyId, createdAt: { gte: since }, campaign: { type: "GOOGLE_REVIEWS" } },
      select: { cardId: true },
    }),
    prisma.ratingEvent.findMany({
      where: { companyId, createdAt: { gte: since }, redirectedGoogle: true },
      select: { cardId: true },
    }),
  ]);
  return countByCard([...campaignRedirects, ...legacyGoogle]);
}

export async function getInstagramTouches(companyId: string, since: Date): Promise<HeatmapRawCount[]> {
  const rows = await prisma.redirectLog.findMany({
    where: { companyId, createdAt: { gte: since }, campaign: { type: "INSTAGRAM" } },
    select: { cardId: true },
  });
  return countByCard(rows);
}

/** Última interação por cartão — `undefined` para um cartão sem nenhum
 * toque na janela, que a UI trata como intensidade zero. */
export async function getLastInteractionByCard(companyId: string, since: Date): Promise<Map<string, Date>> {
  const rows = await prisma.redirectLog.findMany({
    where: { companyId, createdAt: { gte: since } },
    select: { cardId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const lastByCard = new Map<string, Date>();
  for (const row of rows) {
    if (!lastByCard.has(row.cardId)) lastByCard.set(row.cardId, row.createdAt);
  }
  return lastByCard;
}

export async function getHeatmapCounts(companyId: string, layer: Exclude<HeatmapLayer, "CURRENT_CAMPAIGN" | "LAST_INTERACTION">, since: Date): Promise<HeatmapRawCount[]> {
  if (layer === "APPROACHES") return getApproaches(companyId, since);
  if (layer === "CONVERSIONS") return getConversions(companyId, since);
  if (layer === "GOOGLE_REVIEWS") return getGoogleReviewsTouches(companyId, since);
  return getInstagramTouches(companyId, since);
}
