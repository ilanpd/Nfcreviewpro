/**
 * Analytics Enterprise (Fase 7) — tipos compartilhados entre os 5 motores
 * (Analytics/Insights/Forecast/Ranking/Export Engine). Deliberadamente seu
 * próprio módulo de domínio, sem depender de `resolution-engine` ou de
 * `domain/heatmap` — cada motor lê as mesmas tabelas que o resto do produto
 * já grava (`RedirectLog`, `RatingEvent`, `PrivateFeedback`, `Visit`,
 * `AuditLog`), nunca uma tabela de eventos própria. Ver ADR-030.
 */

export interface KpiValue {
  key: string;
  label: string;
  value: number;
  /** Unidade de exibição — some não têm nenhuma (contagens simples). */
  unit?: "percent" | "currency" | "count" | "ms";
  /** Variação percentual vs. o período anterior de mesma duração, quando
   * aplicável (null para KPIs "quem é o melhor X", que não têm uma
   * comparação de série temporal natural). */
  delta?: number | null;
  hint?: string;
}

export type FunnelStageKey = "APPROACH" | "PAGE_OPENED" | "CLICK" | "CONVERSION" | "REVIEW_PUBLISHED";

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  count: number;
  /** % em relação ao estágio anterior — null só no primeiro estágio. */
  dropoffFromPrevious: number | null;
  /** Nota honesta sobre o que exatamente este número mede, exibida como
   * tooltip/caption — obrigatória para estágios que reaproveitam a mesma
   * contagem de outro por limitação real de dado (ver domain/analytics/funnel.ts). */
  caption?: string;
}

export type RankingType = "CAMPAIGN" | "ZONE" | "CARD" | "EMPLOYEE" | "HOUR" | "DAY_OF_WEEK";

export interface RankingEntry {
  id: string;
  label: string;
  /** Métrica primária de ordenação — significado depende de `RankingType`
   * (toques para HOUR/DAY_OF_WEEK, conversões para os demais). */
  value: number;
  secondaryLabel?: string;
  /** Cor opcional para o indicador visual (ex.: cor do tipo de campanha). */
  color?: string;
}

export interface ComparisonResult {
  currentLabel: string;
  previousLabel: string;
  current: number;
  previous: number;
  /** Percentual — positivo é melhora, negativo é piora. `null` quando
   * `previous === 0` e `current === 0` (nada para comparar). */
  deltaPercent: number | null;
}

export type InsightSeverity = "positive" | "neutral" | "attention";

export interface InsightCard {
  id: string;
  message: string;
  severity: InsightSeverity;
  /** Os números exatos por trás da frase — nunca gerado sem isso, para a
   * frase ser auditável, não uma alegação solta. */
  evidence: Record<string, number | string>;
}

export interface ForecastResult {
  metric: string;
  /** Sempre rotulado como estimativa na UI — ver domain/analytics/forecast.ts. */
  currentValue: number;
  targetValue: number;
  dailyRate: number;
  estimatedDays: number | null;
  message: string;
}

export interface RoiSummary {
  configured: boolean;
  estimatedRevenue: number | null;
  avgTicket: number | null;
  returnRate: number | null;
  newCustomerValue: number | null;
  qualifyingInteractions: number;
}

export type TimelineEventKind = "CAMPAIGN_LIFECYCLE" | "AUDIT" | "TOUCH_SPIKE" | "REVIEW_RECORD";

export interface ExecutiveTimelineEntry {
  id: string;
  kind: TimelineEventKind;
  title: string;
  description?: string;
  at: number;
  /** Só presente para eventos com um instante específico e reconstruível
   * pelo Time Machine (Fase 6) — vira um link "Ver no Time Machine". */
  timeMachineAt?: number;
}

export interface CampaignRoi {
  campaignId: string;
  campaignName: string;
  estimatedRevenue: number | null;
  estimatedCost: number | null;
  roiPercent: number | null;
  costPerConversion: number | null;
}
