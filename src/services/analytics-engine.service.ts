import "server-only";
import { startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { analyticsCached } from "@/lib/analytics-cache";
import { buildReviewFunnel } from "@/domain/analytics/funnel";
import { compare, safeDivide } from "@/domain/analytics/math";
import { computeRoiSummary } from "@/domain/analytics/roi";
import { AUDIT_ACTION_LABEL } from "@/domain/audit/labels";
import type { ComparisonResult, ExecutiveTimelineEntry, FunnelStage, KpiValue, RoiSummary } from "@/domain/analytics/types";

/**
 * Analytics Engine (Fase 7) — os números executivos centrais: KPIs, funil e
 * comparativos de período. Lê exatamente as tabelas que o produto já grava
 * (`RedirectLog`, `RatingEvent`, `Visit`) — nenhuma tabela de eventos nova.
 * Deliberadamente separado do Insights/Forecast/Ranking/Export Engine (ver
 * ADR-030): cada um pode evoluir, ser cacheado e (no limite) ser substituído
 * independentemente, ao custo de uma pequena sobreposição de consultas em
 * vez de uma camada de dados 100% compartilhada.
 */

async function countTouches(companyId: string, since: Date, until?: Date) {
  return prisma.redirectLog.count({ where: { companyId, createdAt: until ? { gte: since, lt: until } : { gte: since } } });
}

async function countConversions(companyId: string, since: Date, until?: Date) {
  return prisma.ratingEvent.count({
    where: { companyId, redirectedGoogle: true, createdAt: until ? { gte: since, lt: until } : { gte: since } },
  });
}

export async function getExecutiveKpis(companyId: string, days = 30): Promise<KpiValue[]> {
  return analyticsCached(`${companyId}:kpis:${days}`, () => computeExecutiveKpis(companyId, days));
}

async function computeExecutiveKpis(companyId: string, days: number): Promise<KpiValue[]> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const rangeStart = subDays(todayStart, days - 1);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(weekStart, 1);
  const monthStart = startOfMonth(now);
  const lastMonthStart = subMonths(monthStart, 1);

  const [
    approachesToday,
    touchesInRange,
    conversionsInRange,
    reviewsInRange,
    pageOpensInRange,
    touchesThisWeek,
    touchesLastWeek,
    touchesThisMonth,
    touchesLastMonth,
  ] = await Promise.all([
    countTouches(companyId, todayStart),
    countTouches(companyId, rangeStart),
    countConversions(companyId, rangeStart),
    prisma.ratingEvent.count({ where: { companyId, createdAt: { gte: rangeStart } } }),
    prisma.visit.count({ where: { companyId, createdAt: { gte: rangeStart } } }),
    countTouches(companyId, weekStart),
    countTouches(companyId, lastWeekStart, weekStart),
    countTouches(companyId, monthStart),
    countTouches(companyId, lastMonthStart, monthStart),
  ]);

  const weekGrowth = compare("Esta semana", "Semana anterior", touchesThisWeek, touchesLastWeek);
  const monthGrowth = compare("Este mês", "Mês anterior", touchesThisMonth, touchesLastMonth);
  const roi = await getRoiSummary(companyId, days);

  const kpis: KpiValue[] = [
    { key: "approaches_today", label: "Aproximações hoje", value: approachesToday, unit: "count" },
    { key: "conversions", label: "Conversões", value: conversionsInRange, unit: "count", hint: `Últimos ${days} dias` },
    { key: "reviews_generated", label: "Avaliações geradas", value: reviewsInRange, unit: "count", hint: `Últimos ${days} dias` },
    {
      key: "ctr",
      label: "CTR do fluxo de avaliação",
      value: safeDivide(reviewsInRange, pageOpensInRange) * 100,
      unit: "percent",
      hint: "Avaliações enviadas / páginas abertas",
    },
    {
      key: "conversion_rate",
      label: "Taxa de conversão",
      value: safeDivide(conversionsInRange, touchesInRange) * 100,
      unit: "percent",
      hint: "Conversões / toques totais",
    },
    { key: "weekly_growth", label: "Crescimento semanal", value: touchesThisWeek, unit: "count", delta: weekGrowth.deltaPercent },
    { key: "monthly_growth", label: "Crescimento mensal", value: touchesThisMonth, unit: "count", delta: monthGrowth.deltaPercent },
    {
      key: "estimated_revenue",
      label: "Receita estimada influenciada",
      value: roi.estimatedRevenue ?? 0,
      unit: "currency",
      hint: roi.configured ? `Últimos ${days} dias` : "Configure o ROI Mode em Configurações",
    },
  ];

  return kpis;
}

export async function getFunnel(companyId: string, days = 30): Promise<FunnelStage[]> {
  return analyticsCached(`${companyId}:funnel:${days}`, () => computeFunnel(companyId, days));
}

async function computeFunnel(companyId: string, days: number): Promise<FunnelStage[]> {
  const since = subDays(startOfDay(new Date()), days - 1);

  const [approaches, pageOpens, clicks, conversions] = await Promise.all([
    prisma.redirectLog.count({ where: { companyId, outcome: "REVIEW_FLOW_FALLBACK", createdAt: { gte: since } } }),
    prisma.visit.count({ where: { companyId, createdAt: { gte: since } } }),
    prisma.ratingEvent.count({ where: { companyId, createdAt: { gte: since } } }),
    countConversions(companyId, since),
  ]);

  return buildReviewFunnel({ approaches, pageOpens, clicks, conversions });
}

export interface PeriodComparatives {
  dayOverDay: ComparisonResult;
  weekOverWeek: ComparisonResult;
  monthOverMonth: ComparisonResult;
}

/** Comparativos automáticos (hoje vs. ontem, semana vs. semana anterior, mês
 * vs. mês anterior) sobre toques totais — a métrica mais estável para
 * comparar janelas de tamanhos diferentes sem normalização adicional. */
export async function getPeriodComparatives(companyId: string): Promise<PeriodComparatives> {
  return analyticsCached(`${companyId}:comparatives`, () => computePeriodComparatives(companyId));
}

async function computePeriodComparatives(companyId: string): Promise<PeriodComparatives> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = subDays(todayStart, 1);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(weekStart, 1);
  const monthStart = startOfMonth(now);
  const lastMonthStart = subMonths(monthStart, 1);

  const [today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth] = await Promise.all([
    countTouches(companyId, todayStart),
    countTouches(companyId, yesterdayStart, todayStart),
    countTouches(companyId, weekStart),
    countTouches(companyId, lastWeekStart, weekStart),
    countTouches(companyId, monthStart),
    countTouches(companyId, lastMonthStart, monthStart),
  ]);

  return {
    dayOverDay: compare("Hoje", "Ontem", today, yesterday),
    weekOverWeek: compare("Esta semana", "Semana anterior", thisWeek, lastWeek),
    monthOverMonth: compare("Este mês", "Mês anterior", thisMonth, lastMonth),
  };
}

/** ROI Mode (Fase 7) — ver domain/analytics/roi.ts para a fórmula exata.
 * `qualifyingInteractions` é o total de toques (RedirectLog) no período. */
export async function getRoiSummary(companyId: string, days = 30): Promise<RoiSummary> {
  return analyticsCached(`${companyId}:roi:${days}`, () => computeRoiSummaryForCompany(companyId, days));
}

async function computeRoiSummaryForCompany(companyId: string, days: number): Promise<RoiSummary> {
  const [company, touches] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { roiAvgTicket: true, roiReturnRate: true, roiNewCustomerValue: true } }),
    countTouches(companyId, subDays(startOfDay(new Date()), days - 1)),
  ]);

  return computeRoiSummary(
    { avgTicket: company.roiAvgTicket, returnRate: company.roiReturnRate, newCustomerValue: company.roiNewCustomerValue },
    touches
  );
}

const ASSIGNMENT_AUDIT_ACTIONS = ["CAMPAIGN_ASSIGNED", "CAMPAIGN_UNASSIGNED"] as const;
/** Um pico só vira evento de linha do tempo se passar muito do normal — 80%
 * acima da média do próprio período — para não marcar toda variação comum
 * do dia a dia como um "recorde". */
const SPIKE_THRESHOLD_MULTIPLIER = 1.8;

/**
 * Timeline Executiva (Fase 7) — eventos que realmente aconteceram, nunca
 * inferidos: mudanças de atribuição de campanha (`AuditLog`), campanhas
 * agendadas iniciando/terminando (`Campaign.startsAt/endsAt`), e dois
 * eventos honestamente detectados a partir da própria série de toques —
 * um pico de aproximações e o dia de mais avaliações no período. Cada
 * entrada com um instante específico carrega `timeMachineAt`, para a UI
 * oferecer "Ver no Time Machine" (Fase 6) sem duplicar nenhuma lógica de
 * reconstrução — o Time Machine já sabe colorir o mapa a partir de um
 * timestamp.
 */
export async function getExecutiveTimeline(companyId: string, days = 30): Promise<ExecutiveTimelineEntry[]> {
  return analyticsCached(`${companyId}:timeline:${days}`, () => computeExecutiveTimeline(companyId, days));
}

async function computeExecutiveTimeline(companyId: string, days: number): Promise<ExecutiveTimelineEntry[]> {
  const since = subDays(startOfDay(new Date()), days - 1);
  const entries: ExecutiveTimelineEntry[] = [];

  const [auditRows, campaigns, touchRows, reviewRows] = await Promise.all([
    prisma.auditLog.findMany({
      where: { companyId, createdAt: { gte: since }, action: { in: [...ASSIGNMENT_AUDIT_ACTIONS] } },
      select: { id: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.campaign.findMany({
      where: { companyId, OR: [{ startsAt: { gte: since } }, { endsAt: { gte: since } }] },
      select: { id: true, name: true, startsAt: true, endsAt: true },
    }),
    prisma.redirectLog.findMany({ where: { companyId, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.ratingEvent.findMany({ where: { companyId, createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);

  for (const row of auditRows) {
    entries.push({ id: `audit:${row.id}`, kind: "AUDIT", title: AUDIT_ACTION_LABEL[row.action], at: row.createdAt.getTime() });
  }

  for (const campaign of campaigns) {
    if (campaign.startsAt && campaign.startsAt >= since) {
      entries.push({
        id: `campaign-start:${campaign.id}`,
        kind: "CAMPAIGN_LIFECYCLE",
        title: `Campanha "${campaign.name}" iniciada`,
        at: campaign.startsAt.getTime(),
        timeMachineAt: campaign.startsAt.getTime(),
      });
    }
    if (campaign.endsAt && campaign.endsAt >= since && campaign.endsAt <= new Date()) {
      entries.push({
        id: `campaign-end:${campaign.id}`,
        kind: "CAMPAIGN_LIFECYCLE",
        title: `Campanha "${campaign.name}" encerrada`,
        at: campaign.endsAt.getTime(),
        timeMachineAt: campaign.endsAt.getTime(),
      });
    }
  }

  const dailyTouches = new Map<string, number>();
  for (const row of touchRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    dailyTouches.set(key, (dailyTouches.get(key) ?? 0) + 1);
  }
  if (dailyTouches.size > 1) {
    const values = [...dailyTouches.values()];
    const average = values.reduce((sum, n) => sum + n, 0) / values.length;
    const [peakDay, peakCount] = [...dailyTouches.entries()].sort((a, b) => b[1] - a[1])[0];
    if (average > 0 && peakCount >= average * SPIKE_THRESHOLD_MULTIPLIER) {
      const peakDate = new Date(`${peakDay}T12:00:00`);
      entries.push({
        id: `touch-spike:${peakDay}`,
        kind: "TOUCH_SPIKE",
        title: "Pico de aproximações",
        description: `${peakCount} toques em um único dia — ${(peakCount / average).toFixed(1)}x a média do período.`,
        at: peakDate.getTime(),
        timeMachineAt: peakDate.getTime(),
      });
    }
  }

  const dailyReviews = new Map<string, number>();
  for (const row of reviewRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    dailyReviews.set(key, (dailyReviews.get(key) ?? 0) + 1);
  }
  if (dailyReviews.size > 0) {
    const [recordDay, recordCount] = [...dailyReviews.entries()].sort((a, b) => b[1] - a[1])[0];
    if (recordCount >= 3) {
      const recordDate = new Date(`${recordDay}T12:00:00`);
      entries.push({
        id: `review-record:${recordDay}`,
        kind: "REVIEW_RECORD",
        title: "Recorde de avaliações no período",
        description: `${recordCount} avaliações em um único dia.`,
        at: recordDate.getTime(),
        timeMachineAt: recordDate.getTime(),
      });
    }
  }

  return entries.sort((a, b) => b.at - a.at);
}
