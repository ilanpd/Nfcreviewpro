import type { ComparisonResult } from "./types";

/** Divisão seguindo a mesma convenção de `conversionRate` em
 * `analytics.service.ts` — zero no denominador é "sem dado ainda", não um
 * erro nem `Infinity`/`NaN` vazando para a UI. */
export function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return ((current - previous) / previous) * 100;
}

export function compare(currentLabel: string, previousLabel: string, current: number, previous: number): ComparisonResult {
  return { currentLabel, previousLabel, current, previous, deltaPercent: percentDelta(current, previous) };
}

/** CTR dentro do fluxo de avaliação — cliques (avaliações submetidas) sobre
 * páginas abertas. Ver domain/analytics/funnel.ts para por que o funil desta
 * fase é escopado ao fluxo de avaliação, não a todo toque NFC. */
export function clickThroughRate(clicks: number, pageOpens: number): number {
  return safeDivide(clicks, pageOpens);
}
