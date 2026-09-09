import type { TriggerFireResult } from "./types";

/**
 * Playbook Trigger Evaluators (Fase 11) — um conjunto FIXO e pequeno de
 * funções puras, uma por `PlaybookTriggerType`. O que varia entre "Happy
 * Hour Boost" e "Weekend Accelerator" nunca é código novo aqui — é a linha
 * `Playbook.triggerConfig` (limiares, janela de horário) que
 * `services/playbook-engine.service.ts` passa para a MESMA função. Nenhuma
 * chamada a um modelo, nenhum LLM: cada `headline` é montado a partir dos
 * números exatos em `evidence` — a mesma filosofia auditável do Insight
 * Engine (Fase 7, `domain/analytics/insights.ts`), aplicada agora a uma
 * decisão que pode virar ação com um clique, não só uma frase. Ver ADR-048.
 *
 * `sampleSize`/`deltaPercent`/`recencyHours` de todo resultado alimentam o
 * Confidence Engine — nenhum gatilho decide sozinho "quão confiável" ele é.
 */

function pct(a: number, b: number): number {
  if (b <= 0) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
}

// --- 1. ZONE_TIME_PERFORMANCE (ex.: "Happy Hour Boost") ---

export interface ZoneTimeWindowInput {
  zoneId: string;
  zoneName: string;
  windowTouches: number;
  windowConversions: number;
  restTouches: number;
  restConversions: number;
  windowLabel: string;
}

export interface ZoneTimeWindowConfig {
  minSampleSize: number;
  minDeltaPercent: number;
  maxRecencyHours: number;
}

export function evaluateZoneTimePerformance(
  input: ZoneTimeWindowInput,
  config: ZoneTimeWindowConfig
): TriggerFireResult | null {
  const windowRate = input.windowTouches > 0 ? input.windowConversions / input.windowTouches : 0;
  const restRate = input.restTouches > 0 ? input.restConversions / input.restTouches : 0;
  const sampleSize = input.windowTouches + input.restTouches;
  const deltaPercent = Math.max(0, pct(windowRate, restRate));

  if (sampleSize < config.minSampleSize || deltaPercent < config.minDeltaPercent || windowRate <= restRate) {
    return null;
  }

  return {
    headline: `A zona "${input.zoneName}" converte ${deltaPercent.toFixed(0)}% melhor no horário ${input.windowLabel} do que no resto do dia.`,
    scopeType: "ZONE",
    scopeId: input.zoneId,
    scopeName: input.zoneName,
    evidence: {
      janela: input.windowLabel,
      toquesNaJanela: input.windowTouches,
      conversoesNaJanela: input.windowConversions,
      taxaNaJanela: round2(windowRate * 100),
      toquesForaDaJanela: input.restTouches,
      conversoesForaDaJanela: input.restConversions,
      taxaForaDaJanela: round2(restRate * 100),
    },
    sampleSize,
    deltaPercent,
    recencyHours: 1,
    projectedTouchesDelta: input.windowTouches * 0.3,
    projectedConversionsDelta: input.windowTouches * 0.3 * windowRate,
  };
}

// --- 2. RATING_DROP (ex.: "Google Review Recovery") ---

export interface RatingTrendInput {
  recentTouches: number;
  recentConversions: number;
  baselineTouches: number;
  baselineConversions: number;
  recentWindowHours: number;
}

export interface RatingTrendConfig {
  minSampleSize: number;
  minDropPercent: number;
  maxRecencyHours: number;
}

export function evaluateRatingDrop(input: RatingTrendInput, config: RatingTrendConfig): TriggerFireResult | null {
  const recentRate = input.recentTouches > 0 ? input.recentConversions / input.recentTouches : 0;
  const baselineRate = input.baselineTouches > 0 ? input.baselineConversions / input.baselineTouches : 0;
  const sampleSize = input.recentTouches + input.baselineTouches;
  const dropPercent = Math.max(0, pct(baselineRate, recentRate));

  if (sampleSize < config.minSampleSize || dropPercent < config.minDropPercent || recentRate >= baselineRate) {
    return null;
  }

  return {
    headline: `A conversão para avaliação no Google caiu ${dropPercent.toFixed(0)}% nas últimas ${input.recentWindowHours}h em relação à sua média.`,
    scopeType: "COMPANY",
    scopeId: null,
    scopeName: "toda a empresa",
    evidence: {
      janelaRecenteHoras: input.recentWindowHours,
      toquesRecentes: input.recentTouches,
      conversoesRecentes: input.recentConversions,
      taxaRecente: round2(recentRate * 100),
      toquesLinhaDeBase: input.baselineTouches,
      conversoesLinhaDeBase: input.baselineConversions,
      taxaLinhaDeBase: round2(baselineRate * 100),
    },
    sampleSize,
    deltaPercent: dropPercent,
    recencyHours: input.recentWindowHours / 2,
    projectedTouchesDelta: input.recentTouches * 0.2,
    projectedConversionsDelta: input.recentTouches * 0.2 * (baselineRate - recentRate),
  };
}

// --- 3. SOCIAL_MOMENTUM (ex.: "Instagram Momentum") ---

export interface SocialMomentumInput {
  recentTouches: number;
  priorTouches: number;
  windowHours: number;
  existingCampaignId: string | null;
  existingCampaignName: string | null;
}

export interface SocialMomentumConfig {
  minSampleSize: number;
  minDeltaPercent: number;
  maxRecencyHours: number;
}

export function evaluateSocialMomentum(input: SocialMomentumInput, config: SocialMomentumConfig): TriggerFireResult | null {
  // Só recomenda impulsionar uma campanha que já existe — nunca inventa uma
  // URL de Instagram que a empresa não configurou (ver ADR-048).
  if (!input.existingCampaignId) return null;

  const sampleSize = input.recentTouches + input.priorTouches;
  const deltaPercent = Math.max(0, pct(input.recentTouches, input.priorTouches));

  if (sampleSize < config.minSampleSize || deltaPercent < config.minDeltaPercent || input.recentTouches <= input.priorTouches) {
    return null;
  }

  return {
    headline: `Os toques em "${input.existingCampaignName}" no Instagram subiram ${deltaPercent.toFixed(0)}% nas últimas ${input.windowHours}h — aproveitar o momentum agora?`,
    scopeType: "COMPANY",
    scopeId: null,
    scopeName: "toda a empresa",
    targetCampaignId: input.existingCampaignId,
    evidence: {
      campanha: input.existingCampaignName ?? "",
      janelaHoras: input.windowHours,
      toquesRecentes: input.recentTouches,
      toquesAnteriores: input.priorTouches,
    },
    sampleSize,
    deltaPercent,
    recencyHours: input.windowHours / 2,
    projectedTouchesDelta: input.recentTouches * 0.25,
    projectedConversionsDelta: input.recentTouches * 0.05,
  };
}

// --- 4. VIP_TABLE_IDLE (ex.: "VIP Table Recovery") ---

export interface IdleScopeInput {
  scopeId: string;
  scopeName: string;
  hoursSinceLastInteraction: number;
  avgHoursBetweenInteractions: number;
}

export interface IdleScopeConfig {
  idleMultiplier: number;
  minAvgHours: number;
  maxRecencyHours: number;
}

export function evaluateVipTableIdle(input: IdleScopeInput, config: IdleScopeConfig): TriggerFireResult | null {
  const baseline = Math.max(config.minAvgHours, input.avgHoursBetweenInteractions);
  const threshold = baseline * config.idleMultiplier;

  if (input.hoursSinceLastInteraction < threshold) return null;

  const deltaPercent = Math.max(0, pct(input.hoursSinceLastInteraction, baseline));

  return {
    headline: `A mesa VIP "${input.scopeName}" está silenciosa há ${input.hoursSinceLastInteraction.toFixed(0)}h — bem acima do seu padrão de ${baseline.toFixed(0)}h.`,
    scopeType: "CARD",
    scopeId: input.scopeId,
    scopeName: input.scopeName,
    evidence: {
      horasSemInteracao: round2(input.hoursSinceLastInteraction),
      mediaHistoricaHoras: round2(baseline),
      limiar: round2(threshold),
    },
    sampleSize: 1,
    deltaPercent,
    recencyHours: input.hoursSinceLastInteraction,
    projectedTouchesDelta: 1,
    projectedConversionsDelta: 0.3,
  };
}

// --- 5. ZONE_SILENT (ex.: "Silent Zone Rescue") ---

export function evaluateZoneSilent(input: IdleScopeInput, config: IdleScopeConfig): TriggerFireResult | null {
  const baseline = Math.max(config.minAvgHours, input.avgHoursBetweenInteractions);
  const threshold = baseline * config.idleMultiplier;

  if (input.hoursSinceLastInteraction < threshold) return null;

  const deltaPercent = Math.max(0, pct(input.hoursSinceLastInteraction, baseline));

  return {
    headline: `A zona "${input.scopeName}" está sem nenhum toque há ${input.hoursSinceLastInteraction.toFixed(0)}h — bem acima do seu padrão de ${baseline.toFixed(0)}h.`,
    scopeType: "ZONE",
    scopeId: input.scopeId,
    scopeName: input.scopeName,
    evidence: {
      horasSemInteracao: round2(input.hoursSinceLastInteraction),
      mediaHistoricaHoras: round2(baseline),
      limiar: round2(threshold),
    },
    sampleSize: 1,
    deltaPercent,
    recencyHours: input.hoursSinceLastInteraction,
    projectedTouchesDelta: 3,
    projectedConversionsDelta: 0.6,
  };
}

// --- 6. LUNCH_WINDOW_UNDERUSED (ex.: "Lunch Rush Optimization") ---

export interface LunchWindowInput {
  lunchTouches: number;
  totalTouches: number;
  windowLabel: string;
}

export interface LunchWindowConfig {
  expectedSharePercent: number;
  minDeltaPercent: number;
  minSampleSize: number;
  maxRecencyHours: number;
}

export function evaluateLunchWindowUnderused(input: LunchWindowInput, config: LunchWindowConfig): TriggerFireResult | null {
  if (input.totalTouches < config.minSampleSize) return null;

  const actualSharePercent = (input.lunchTouches / input.totalTouches) * 100;
  const gapPercent = Math.max(0, pct(config.expectedSharePercent, actualSharePercent));

  if (gapPercent < config.minDeltaPercent) return null;

  return {
    headline: `A janela de almoço (${input.windowLabel}) responde por só ${actualSharePercent.toFixed(0)}% dos toques — ${gapPercent.toFixed(0)}% abaixo do esperado.`,
    scopeType: "COMPANY",
    scopeId: null,
    scopeName: "toda a empresa",
    evidence: {
      janela: input.windowLabel,
      toquesNoAlmoco: input.lunchTouches,
      toquesTotais: input.totalTouches,
      participacaoAtual: round2(actualSharePercent),
      participacaoEsperada: config.expectedSharePercent,
    },
    sampleSize: input.totalTouches,
    deltaPercent: gapPercent,
    recencyHours: 12,
    projectedTouchesDelta: input.totalTouches * 0.05,
    projectedConversionsDelta: input.totalTouches * 0.05 * 0.1,
  };
}

// --- 7. WEEKEND_FORECAST_UP (ex.: "Weekend Accelerator") ---

export interface WeekendForecastInput {
  campaignId: string | null;
  campaignName: string | null;
  dailyRate: number;
  forecastedUpliftPercent: number;
}

export interface WeekendForecastConfig {
  minUpliftPercent: number;
  minDailyRate: number;
}

export function evaluateWeekendForecastUp(input: WeekendForecastInput, config: WeekendForecastConfig): TriggerFireResult | null {
  if (input.dailyRate < config.minDailyRate || input.forecastedUpliftPercent < config.minUpliftPercent) return null;

  const label = input.campaignName ? `"${input.campaignName}"` : "sua campanha de melhor desempenho";

  return {
    headline: `A projeção aponta ${input.forecastedUpliftPercent.toFixed(0)}% de alta para o fim de semana — reforçar ${label} agora?`,
    scopeType: "COMPANY",
    scopeId: null,
    scopeName: "toda a empresa",
    targetCampaignId: input.campaignId,
    evidence: {
      campanha: input.campaignName ?? "nenhuma campanha ativa",
      mediaDiariaAtual: round2(input.dailyRate),
      altaProjetadaPercent: round2(input.forecastedUpliftPercent),
    },
    sampleSize: Math.round(input.dailyRate * 7),
    deltaPercent: input.forecastedUpliftPercent,
    recencyHours: 24,
    projectedTouchesDelta: input.dailyRate * 2,
    projectedConversionsDelta: input.dailyRate * 2 * 0.15,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
