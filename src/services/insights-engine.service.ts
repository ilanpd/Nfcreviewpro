import "server-only";
import { subDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { analyticsCached } from "@/lib/analytics-cache";
import { generateInsights, type CardPeakHourInput, type CampaignPerformanceInput, type ZoneComparisonInput } from "@/domain/analytics/insights";
import { getLocalDateParts } from "@/domain/rules/timezone";
import { getRanking } from "@/services/ranking-engine.service";
import type { InsightCard } from "@/domain/analytics/types";

/**
 * Insights Engine (Fase 7) — monta os insumos reais (zonas, campanhas, o
 * cartão líder e seu horário de pico) e delega toda a decisão de "isso vira
 * uma frase ou não" para `domain/analytics/insights.ts`, que é puro e
 * testável sem banco. Depende do Ranking Engine para a comparação de zonas
 * (reaproveita a mesma consulta, não duplica) — a única dependência
 * deliberada entre os 5 motores desta fase; ver ADR-030 para por que isso
 * ainda conta como "desacoplado" (responsabilidade única, substituível
 * independentemente) e não uma bola de lama.
 */

async function getZoneComparisonInputs(companyId: string, since: Date): Promise<ZoneComparisonInput[]> {
  const [cards, zones, touchRows, conversionRows] = await Promise.all([
    prisma.nFCCard.findMany({ where: { companyId, zoneId: { not: null } }, select: { id: true, zoneId: true } }),
    prisma.zone.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.redirectLog.findMany({ where: { companyId, createdAt: { gte: since } }, select: { cardId: true } }),
    prisma.ratingEvent.findMany({ where: { companyId, redirectedGoogle: true, createdAt: { gte: since } }, select: { cardId: true } }),
  ]);

  const zoneByCard = new Map(cards.map((c) => [c.id, c.zoneId!]));

  const touchesByZone = new Map<string, number>();
  for (const row of touchRows) {
    const zoneId = zoneByCard.get(row.cardId);
    if (zoneId) touchesByZone.set(zoneId, (touchesByZone.get(zoneId) ?? 0) + 1);
  }
  const conversionsByZone = new Map<string, number>();
  for (const row of conversionRows) {
    const zoneId = zoneByCard.get(row.cardId);
    if (zoneId) conversionsByZone.set(zoneId, (conversionsByZone.get(zoneId) ?? 0) + 1);
  }

  return zones.map((zone) => ({
    id: zone.id,
    label: `${zone.name}`.startsWith("Zona") ? zone.name : `zona ${zone.name}`,
    touches: touchesByZone.get(zone.id) ?? 0,
    conversions: conversionsByZone.get(zone.id) ?? 0,
  }));
}

async function getCampaignPerformanceInputs(companyId: string, days: number): Promise<CampaignPerformanceInput[]> {
  const entries = await getRanking(companyId, "CAMPAIGN", days, 20);
  return entries.map((e) => ({ id: e.id, label: e.label, touches: e.value }));
}

/** Janela de pico de 2h para o cartão líder de conversões — simples e
 * honesto: o "bucket" de hora local com mais conversões, mais a hora
 * seguinte, não uma detecção estatística de janela ótima. */
async function getTopCardPeakHour(companyId: string, days: number, since: Date): Promise<CardPeakHourInput | null> {
  const top = (await getRanking(companyId, "CARD", days, 1))[0];
  if (!top) return null;

  const [company, rows] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { timezone: true } }),
    prisma.ratingEvent.findMany({ where: { companyId, cardId: top.id, redirectedGoogle: true, createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);

  const hourCounts = new Map<number, number>();
  for (const row of rows) {
    const hour = getLocalDateParts(row.createdAt, company.timezone).hour;
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  if (hourCounts.size === 0) return null;

  const peakHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { id: top.id, label: top.label, conversions: top.value, peakHourStart: peakHour, peakHourEnd: (peakHour + 2) % 24 };
}

export async function getInsights(companyId: string, days = 30): Promise<InsightCard[]> {
  return analyticsCached(`${companyId}:insights:${days}`, () => computeInsights(companyId, days));
}

async function computeInsights(companyId: string, days: number): Promise<InsightCard[]> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = subDays(todayStart, 1);
  const since = subDays(todayStart, days - 1);

  const [zones, campaigns, topCard, touchesToday, touchesYesterday] = await Promise.all([
    getZoneComparisonInputs(companyId, since),
    getCampaignPerformanceInputs(companyId, days),
    getTopCardPeakHour(companyId, days, since),
    prisma.redirectLog.count({ where: { companyId, createdAt: { gte: todayStart } } }),
    prisma.redirectLog.count({ where: { companyId, createdAt: { gte: yesterdayStart, lt: todayStart } } }),
  ]);

  return generateInsights({ zones, campaigns, topCard, touchesToday, touchesYesterday });
}
