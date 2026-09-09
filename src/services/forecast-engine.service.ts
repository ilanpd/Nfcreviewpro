import "server-only";
import { subDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { analyticsCached } from "@/lib/analytics-cache";
import { projectLinearForecast } from "@/domain/analytics/forecast";
import { percentDelta } from "@/domain/analytics/math";
import { getRanking } from "@/services/ranking-engine.service";
import type { ForecastResult } from "@/domain/analytics/types";

/**
 * Forecast Engine (Fase 7) — projeções lineares simples (ver
 * domain/analytics/forecast.ts para por que não é um modelo estatístico
 * sofisticado). Duas projeções, cada uma honesta sobre o que mede:
 *   - `getReviewGoalForecast`: quando uma meta de total de avaliações será
 *     alcançada, a partir do ritmo diário recente.
 *   - `getTopCampaignTrend`: crescimento de TOQUES (não conversões — ver a
 *     nota grande em domain/analytics/insights.ts) da campanha mais usada,
 *     esta semana vs. a anterior.
 */
const RECENT_WINDOW_DAYS = 14;

async function getDailyReviewCounts(companyId: string, days: number): Promise<number[]> {
  const since = subDays(startOfDay(new Date()), days - 1);
  const rows = await prisma.ratingEvent.findMany({ where: { companyId, createdAt: { gte: since } }, select: { createdAt: true } });

  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) counts.set(subDays(startOfDay(new Date()), days - 1 - i).toISOString().slice(0, 10), 0);
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()];
}

export async function getReviewGoalForecast(companyId: string, goal: number): Promise<ForecastResult> {
  return analyticsCached(`${companyId}:forecast:reviews:${goal}`, () => computeReviewGoalForecast(companyId, goal));
}

async function computeReviewGoalForecast(companyId: string, goal: number): Promise<ForecastResult> {
  const [currentValue, dailyCounts] = await Promise.all([
    prisma.ratingEvent.count({ where: { companyId } }),
    getDailyReviewCounts(companyId, RECENT_WINDOW_DAYS),
  ]);

  return projectLinearForecast("avaliações", currentValue, goal, dailyCounts);
}

export interface CampaignTrendForecast {
  campaignId: string;
  campaignName: string;
  thisWeekTouches: number;
  lastWeekTouches: number;
  trendPercent: number | null;
  message: string;
}

export async function getTopCampaignTrend(companyId: string): Promise<CampaignTrendForecast | null> {
  return analyticsCached(`${companyId}:forecast:campaign-trend`, () => computeTopCampaignTrend(companyId));
}

async function computeTopCampaignTrend(companyId: string): Promise<CampaignTrendForecast | null> {
  const top = (await getRanking(companyId, "CAMPAIGN", 30, 1))[0];
  if (!top) return null;

  const now = new Date();
  const [thisWeekTouches, lastWeekTouches] = await Promise.all([
    prisma.redirectLog.count({ where: { companyId, campaignId: top.id, createdAt: { gte: subDays(now, 7) } } }),
    prisma.redirectLog.count({ where: { companyId, campaignId: top.id, createdAt: { gte: subDays(now, 14), lt: subDays(now, 7) } } }),
  ]);

  const trendPercent = percentDelta(thisWeekTouches, lastWeekTouches);
  const message =
    trendPercent === null
      ? `Ainda não há dados suficientes para estimar a tendência de "${top.label}".`
      : trendPercent >= 0
        ? `Sua campanha "${top.label}" tende a manter ${trendPercent.toFixed(0)}% mais toques que a semana anterior, mantido o ritmo atual.`
        : `Sua campanha "${top.label}" teve ${Math.abs(trendPercent).toFixed(0)}% menos toques que a semana anterior.`;

  return { campaignId: top.id, campaignName: top.label, thisWeekTouches, lastWeekTouches, trendPercent, message };
}
