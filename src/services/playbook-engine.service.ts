import "server-only";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { publishEvent } from "@/lib/event-bus";
import { getLocalDateParts } from "@/domain/rules/timezone";
import { computeConfidence } from "@/domain/playbooks/confidence-engine";
import { estimateImpact } from "@/domain/playbooks/impact";
import * as triggers from "@/domain/playbooks/triggers";
import type { PlaybookDefinition, TriggerFireResult } from "@/domain/playbooks/types";
import type { Prisma, TargetScope } from "@/generated/prisma/client";
import { maybeAutoExecute } from "./automation-engine.service";

/**
 * Playbook Engine (Fase 11) — o motor que avalia o catálogo declarativo de
 * `Playbook` contra dados reais de UMA empresa e, quando um gatilho dispara,
 * cria uma `PlaybookRecommendation`. Nunca decide sozinho aplicar nada — só
 * o AutoPilot Engine (chamado no fim deste arquivo) pode transformar uma
 * recomendação recém-criada em execução automática, e só sob as condições de
 * segurança de `automation-engine.service.ts`. Ver ADR-048.
 *
 * Disparado de duas formas (nunca uma terceira "solta"):
 *   1. Evento real de comportamento do cliente → fila "playbooks" →
 *      `lib/workers/processors.ts`'s `playbooksProcessor` → esta função.
 *   2. Varredura periódica via Cron (`/api/playbooks/evaluate`) — necessária
 *      para gatilhos de AUSÊNCIA de evento (uma zona silenciosa não gera
 *      nenhum evento para reagir).
 */

const ANALYTICS_DAYS = 14;
const EVAL_DEBOUNCE_SECONDS = 30 * 60; // no máximo 1 avaliação por empresa a cada 30min via evento

export async function listPlaybooks(): Promise<PlaybookDefinition[]> {
  const rows = await prisma.playbook.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return rows.map(toDefinition);
}

function toDefinition(row: {
  id: string; key: string; name: string; description: string; category: PlaybookDefinition["category"];
  triggerType: PlaybookDefinition["triggerType"]; triggerConfig: unknown; actionType: PlaybookDefinition["actionType"];
  actionConfig: unknown; estimatedDurationHours: number; reversalDescription: string; safeForAutomation: boolean;
}): PlaybookDefinition {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    triggerType: row.triggerType,
    triggerConfig: (row.triggerConfig as Record<string, unknown>) ?? {},
    actionType: row.actionType,
    actionConfig: (row.actionConfig as Record<string, unknown>) ?? {},
    estimatedDurationHours: row.estimatedDurationHours,
    reversalDescription: row.reversalDescription,
    safeForAutomation: row.safeForAutomation,
  };
}

/** Debounce best-effort (degrada para "sempre avalia" sem Redis — nunca
 * bloqueia uma avaliação por causa de infraestrutura de apoio ausente,
 * mesmo padrão de `lib/queues/idempotency.ts`). */
async function claimEvaluationWindow(companyId: string): Promise<boolean> {
  if (!redis) return true;
  try {
    const result = await redis.set(`playbooks:eval-window:${companyId}`, "1", { nx: true, ex: EVAL_DEBOUNCE_SECONDS });
    return result !== null;
  } catch {
    return true;
  }
}

export async function evaluatePlaybooksForCompany(companyId: string, options: { fromEvent?: boolean } = {}): Promise<number> {
  if (options.fromEvent) {
    const shouldRun = await claimEvaluationWindow(companyId);
    if (!shouldRun) return 0;
  }

  const [company, playbooks] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    listPlaybooks(),
  ]);
  if (!company) return 0;

  const roiConfig = { avgTicket: company.roiAvgTicket, returnRate: company.roiReturnRate, newCustomerValue: company.roiNewCustomerValue };
  let created = 0;

  for (const playbook of playbooks) {
    try {
      const fire = await evaluateOne(companyId, company.timezone, playbook);
      if (!fire) continue;
      const recommendation = await createRecommendationIfNotConflicting(companyId, playbook, fire, roiConfig);
      if (recommendation) {
        created += 1;
        await publishEvent("RecomendacaoGerada", { recommendationId: recommendation.id, playbookKey: playbook.key, confidence: recommendation.confidence }, { companyId });
        await maybeAutoExecute(recommendation.id);
      }
    } catch (err) {
      console.error(`[playbook-engine] falha ao avaliar "${playbook.key}" para ${companyId}`, err);
    }
  }

  return created;
}

async function evaluateOne(companyId: string, timezone: string, playbook: PlaybookDefinition): Promise<TriggerFireResult | null> {
  switch (playbook.triggerType) {
    case "ZONE_TIME_PERFORMANCE":
      return evaluateZoneTimePerformance(companyId, timezone, playbook);
    case "RATING_DROP":
      return evaluateRatingDrop(companyId, playbook);
    case "SOCIAL_MOMENTUM":
      return evaluateSocialMomentum(companyId, playbook);
    case "VIP_TABLE_IDLE":
      return evaluateVipTableIdle(companyId, playbook);
    case "ZONE_SILENT":
      return evaluateZoneSilent(companyId, playbook);
    case "LUNCH_WINDOW_UNDERUSED":
      return evaluateLunchWindowUnderused(companyId, timezone, playbook);
    case "WEEKEND_FORECAST_UP":
      return evaluateWeekendForecastUp(companyId, playbook);
  }
}

// --- Agregações reais por gatilho — cada uma alimenta a função pura correspondente em domain/playbooks/triggers.ts ---

async function evaluateZoneTimePerformance(companyId: string, timezone: string, playbook: PlaybookDefinition) {
  const cfg = playbook.triggerConfig as { windowStartHour: number; windowEndHour: number; windowLabel: string; minSampleSize: number; minDeltaPercent: number; maxRecencyHours: number };
  const since = new Date(Date.now() - ANALYTICS_DAYS * 86_400_000);

  const [zones, redirects, conversions] = await Promise.all([
    prisma.zone.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.redirectLog.findMany({ where: { companyId, createdAt: { gte: since } }, select: { createdAt: true, card: { select: { zoneId: true } } } }),
    prisma.ratingEvent.findMany({ where: { companyId, redirectedGoogle: true, createdAt: { gte: since } }, select: { createdAt: true, cardId: true } }),
  ]);
  if (zones.length === 0) return null;

  const cardZoneMap = await cardToZoneMap(companyId);

  for (const zone of zones) {
    let windowTouches = 0, restTouches = 0, windowConv = 0, restConv = 0;
    for (const r of redirects) {
      if (r.card.zoneId !== zone.id) continue;
      const inWindow = isInHourWindow(getLocalDateParts(r.createdAt, timezone).hour, cfg.windowStartHour, cfg.windowEndHour);
      if (inWindow) windowTouches += 1; else restTouches += 1;
    }
    for (const c of conversions) {
      if (cardZoneMap.get(c.cardId) !== zone.id) continue;
      const inWindow = isInHourWindow(getLocalDateParts(c.createdAt, timezone).hour, cfg.windowStartHour, cfg.windowEndHour);
      if (inWindow) windowConv += 1; else restConv += 1;
    }

    const result = triggers.evaluateZoneTimePerformance(
      { zoneId: zone.id, zoneName: zone.name, windowTouches, windowConversions: windowConv, restTouches, restConversions: restConv, windowLabel: cfg.windowLabel },
      { minSampleSize: cfg.minSampleSize, minDeltaPercent: cfg.minDeltaPercent, maxRecencyHours: cfg.maxRecencyHours }
    );
    if (result) return result;
  }
  return null;
}

async function evaluateRatingDrop(companyId: string, playbook: PlaybookDefinition) {
  const cfg = playbook.triggerConfig as { recentWindowHours: number; minSampleSize: number; minDropPercent: number; maxRecencyHours: number };
  const now = Date.now();
  const recentSince = new Date(now - cfg.recentWindowHours * 3_600_000);
  const baselineSince = new Date(now - cfg.recentWindowHours * 4 * 3_600_000);

  const [recentTouches, recentConversions, baselineTouches, baselineConversions] = await Promise.all([
    prisma.redirectLog.count({ where: { companyId, createdAt: { gte: recentSince } } }),
    prisma.ratingEvent.count({ where: { companyId, redirectedGoogle: true, createdAt: { gte: recentSince } } }),
    prisma.redirectLog.count({ where: { companyId, createdAt: { gte: baselineSince, lt: recentSince } } }),
    prisma.ratingEvent.count({ where: { companyId, redirectedGoogle: true, createdAt: { gte: baselineSince, lt: recentSince } } }),
  ]);

  return triggers.evaluateRatingDrop(
    { recentTouches, recentConversions, baselineTouches, baselineConversions, recentWindowHours: cfg.recentWindowHours },
    { minSampleSize: cfg.minSampleSize, minDropPercent: cfg.minDropPercent, maxRecencyHours: cfg.maxRecencyHours }
  );
}

async function evaluateSocialMomentum(companyId: string, playbook: PlaybookDefinition) {
  const cfg = playbook.triggerConfig as { windowHours: number; minSampleSize: number; minDeltaPercent: number; maxRecencyHours: number };
  const now = Date.now();
  const recentSince = new Date(now - cfg.windowHours * 3_600_000);
  const priorSince = new Date(now - cfg.windowHours * 2 * 3_600_000);

  const existingCampaign = await prisma.campaign.findFirst({
    where: { companyId, type: "INSTAGRAM", status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { priority: "desc" },
  });
  if (!existingCampaign) return null; // nunca inventa uma campanha de Instagram — ver ADR-048

  const [recentTouches, priorTouches] = await Promise.all([
    prisma.redirectLog.count({ where: { companyId, campaignId: existingCampaign.id, createdAt: { gte: recentSince } } }),
    prisma.redirectLog.count({ where: { companyId, campaignId: existingCampaign.id, createdAt: { gte: priorSince, lt: recentSince } } }),
  ]);

  return triggers.evaluateSocialMomentum(
    { recentTouches, priorTouches, windowHours: cfg.windowHours, existingCampaignId: existingCampaign.id, existingCampaignName: existingCampaign.name },
    { minSampleSize: cfg.minSampleSize, minDeltaPercent: cfg.minDeltaPercent, maxRecencyHours: cfg.maxRecencyHours }
  );
}

async function evaluateVipTableIdle(companyId: string, playbook: PlaybookDefinition) {
  const cfg = playbook.triggerConfig as { tag: string; idleMultiplier: number; minAvgHours: number; maxRecencyHours: number };
  const cards = await prisma.nFCCard.findMany({ where: { companyId, active: true, tags: { has: cfg.tag } }, select: { id: true, name: true, createdAt: true } });
  if (cards.length === 0) return null;

  const cardIds = cards.map((c) => c.id);
  const lastTouches = await prisma.redirectLog.groupBy({ by: ["cardId"], where: { companyId, cardId: { in: cardIds } }, _max: { createdAt: true }, _count: { _all: true } });
  const lastByCard = new Map(lastTouches.map((r) => [r.cardId, r]));
  const now = Date.now();

  for (const card of cards) {
    const stats = lastByCard.get(card.id);
    const lastAt = stats?._max.createdAt ?? card.createdAt;
    const hoursSince = (now - lastAt.getTime()) / 3_600_000;
    const daysActive = Math.max(1, (now - card.createdAt.getTime()) / 86_400_000);
    const avgHours = stats && stats._count._all > 0 ? (daysActive * 24) / stats._count._all : daysActive * 24;

    const result = triggers.evaluateVipTableIdle(
      { scopeId: card.id, scopeName: card.name, hoursSinceLastInteraction: hoursSince, avgHoursBetweenInteractions: avgHours },
      { idleMultiplier: cfg.idleMultiplier, minAvgHours: cfg.minAvgHours, maxRecencyHours: cfg.maxRecencyHours }
    );
    if (result) return result;
  }
  return null;
}

async function evaluateZoneSilent(companyId: string, playbook: PlaybookDefinition) {
  const cfg = playbook.triggerConfig as { idleMultiplier: number; minAvgHours: number; maxRecencyHours: number };
  const zones = await prisma.zone.findMany({ where: { companyId }, select: { id: true, name: true, createdAt: true } });
  if (zones.length === 0) return null;

  const cardZoneMap = await cardToZoneMap(companyId);
  const cardIds = [...cardZoneMap.keys()];
  const lastTouches = await prisma.redirectLog.groupBy({ by: ["cardId"], where: { companyId, cardId: { in: cardIds } }, _max: { createdAt: true }, _count: { _all: true } });

  const now = Date.now();
  for (const zone of zones) {
    const zoneCardIds = [...cardZoneMap.entries()].filter(([, z]) => z === zone.id).map(([id]) => id);
    if (zoneCardIds.length === 0) continue;
    const zoneTouches = lastTouches.filter((t) => zoneCardIds.includes(t.cardId));
    const lastAt = zoneTouches.length > 0 ? new Date(Math.max(...zoneTouches.map((t) => t._max.createdAt!.getTime()))) : zone.createdAt;
    const totalCount = zoneTouches.reduce((sum, t) => sum + t._count._all, 0);
    const hoursSince = (now - lastAt.getTime()) / 3_600_000;
    const daysActive = Math.max(1, (now - zone.createdAt.getTime()) / 86_400_000);
    const avgHours = totalCount > 0 ? (daysActive * 24) / totalCount : daysActive * 24;

    const result = triggers.evaluateZoneSilent(
      { scopeId: zone.id, scopeName: zone.name, hoursSinceLastInteraction: hoursSince, avgHoursBetweenInteractions: avgHours },
      { idleMultiplier: cfg.idleMultiplier, minAvgHours: cfg.minAvgHours, maxRecencyHours: cfg.maxRecencyHours }
    );
    if (result) return result;
  }
  return null;
}

async function evaluateLunchWindowUnderused(companyId: string, timezone: string, playbook: PlaybookDefinition) {
  const cfg = playbook.triggerConfig as { windowStartHour: number; windowEndHour: number; windowLabel: string; expectedSharePercent: number; minDeltaPercent: number; minSampleSize: number; maxRecencyHours: number };
  const since = new Date(Date.now() - ANALYTICS_DAYS * 86_400_000);
  const redirects = await prisma.redirectLog.findMany({ where: { companyId, createdAt: { gte: since } }, select: { createdAt: true } });

  let lunchTouches = 0;
  for (const r of redirects) {
    if (isInHourWindow(getLocalDateParts(r.createdAt, timezone).hour, cfg.windowStartHour, cfg.windowEndHour)) lunchTouches += 1;
  }

  return triggers.evaluateLunchWindowUnderused(
    { lunchTouches, totalTouches: redirects.length, windowLabel: cfg.windowLabel },
    { expectedSharePercent: cfg.expectedSharePercent, minDeltaPercent: cfg.minDeltaPercent, minSampleSize: cfg.minSampleSize, maxRecencyHours: cfg.maxRecencyHours }
  );
}

async function evaluateWeekendForecastUp(companyId: string, playbook: PlaybookDefinition) {
  const cfg = playbook.triggerConfig as { minUpliftPercent: number; minDailyRate: number };
  const since = new Date(Date.now() - 7 * 86_400_000);
  const midpoint = new Date(Date.now() - 3.5 * 86_400_000);

  const topCampaign = await prisma.campaign.findFirst({
    where: { companyId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { priority: "desc" },
  });
  if (!topCampaign) return null; // sem campanha ativa para reforçar — nunca cria uma nova aqui (ver ADR-048)

  const [firstHalf, secondHalf] = await Promise.all([
    prisma.redirectLog.count({ where: { companyId, createdAt: { gte: since, lt: midpoint }, campaignId: topCampaign.id } }),
    prisma.redirectLog.count({ where: { companyId, createdAt: { gte: midpoint }, campaignId: topCampaign.id } }),
  ]);

  const dailyRate = (firstHalf + secondHalf) / 7;
  const upliftPercent = firstHalf > 0 ? Math.max(0, ((secondHalf - firstHalf) / firstHalf) * 100) : secondHalf > 0 ? 100 : 0;

  return triggers.evaluateWeekendForecastUp(
    { campaignId: topCampaign.id, campaignName: topCampaign.name, dailyRate, forecastedUpliftPercent: upliftPercent },
    { minUpliftPercent: cfg.minUpliftPercent, minDailyRate: cfg.minDailyRate }
  );
}

async function cardToZoneMap(companyId: string): Promise<Map<string, string | null>> {
  const cards = await prisma.nFCCard.findMany({ where: { companyId }, select: { id: true, zoneId: true } });
  return new Map(cards.map((c) => [c.id, c.zoneId]));
}

function isInHourWindow(hour: number, start: number, end: number): boolean {
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end; // janela que atravessa a meia-noite
}

/**
 * Dedup/anti-conflito (Architect Review — "playbooks conflitantes",
 * "execuções simultâneas"): nunca cria uma nova recomendação para um escopo
 * que já tem uma PENDENTE, ou uma APLICADA recentemente (dentro da janela de
 * duração do playbook que a aplicou) — de QUALQUER playbook, não só o
 * mesmo. Duas recomendações competindo pela mesma mesa/zona ao mesmo tempo
 * nunca chegam a existir simultaneamente.
 */
async function createRecommendationIfNotConflicting(
  companyId: string,
  playbook: PlaybookDefinition,
  fire: TriggerFireResult,
  roiConfig: { avgTicket: number | null; returnRate: number | null; newCustomerValue: number | null }
) {
  const cooldownSince = new Date(Date.now() - playbook.estimatedDurationHours * 3_600_000);

  const conflicting = await prisma.playbookRecommendation.findFirst({
    where: {
      companyId,
      scopeType: fire.scopeType as TargetScope,
      scopeId: fire.scopeId,
      OR: [{ status: "PENDING" }, { status: "APPLIED", respondedAt: { gte: cooldownSince } }],
    },
  });
  if (conflicting) return null;

  const confidence = computeConfidence({
    sampleSize: fire.sampleSize,
    minSampleSize: (playbook.triggerConfig as { minSampleSize?: number }).minSampleSize ?? 10,
    deltaPercent: fire.deltaPercent,
    minDeltaPercent: (playbook.triggerConfig as { minDeltaPercent?: number }).minDeltaPercent ?? 15,
    recencyHours: fire.recencyHours,
    maxRecencyHours: (playbook.triggerConfig as { maxRecencyHours?: number }).maxRecencyHours ?? 48,
  });
  const impact = estimateImpact(fire.projectedTouchesDelta, fire.projectedConversionsDelta, roiConfig);

  return prisma.playbookRecommendation.create({
    data: {
      companyId,
      playbookId: playbook.id,
      confidence: confidence.score,
      confidenceFactors: confidence.factors as unknown as Prisma.InputJsonValue,
      estimatedImpact: impact as unknown as Prisma.InputJsonValue,
      evidence: fire.evidence as Prisma.InputJsonValue,
      headline: fire.headline,
      scopeType: fire.scopeType as TargetScope,
      scopeId: fire.scopeId,
      targetCampaignId: fire.targetCampaignId ?? null,
      expiresAt: new Date(Date.now() + playbook.estimatedDurationHours * 3_600_000 * 2),
    },
  });
}
