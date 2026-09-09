import type { ConfidenceFactor, ConfidenceResult } from "./types";

/**
 * Confidence Engine (Fase 11) — Explainability First exige que toda
 * recomendação mostre "qual confiança possui", nunca um número decorativo.
 * A confiança é a média ponderada de três fatores determinísticos, cada um
 * recalculável a partir da evidência mostrada no Explainability Panel —
 * mesma filosofia do Insight Engine (Fase 7, `domain/analytics/insights.ts`):
 * nenhuma chamada a um modelo, nenhum score que não possa ser auditado.
 *
 *   - Amostra: o gatilho tem dado suficiente para não ser ruído?
 *   - Efeito: a diferença observada é grande o bastante para importar?
 *   - Atualidade: o dado é recente, ou já pode estar desatualizado?
 */
const WEIGHTS = { sample: 0.4, effect: 0.4, recency: 0.2 } as const;

export interface ConfidenceInput {
  sampleSize: number;
  minSampleSize: number;
  deltaPercent: number;
  minDeltaPercent: number;
  recencyHours: number;
  maxRecencyHours: number;
}

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const sampleFactor = clamp01(input.sampleSize / Math.max(1, input.minSampleSize));
  const effectFactor = clamp01(input.deltaPercent / Math.max(1, input.minDeltaPercent));
  const recencyFactor = clamp01(1 - input.recencyHours / Math.max(1, input.maxRecencyHours));

  const factors: ConfidenceFactor[] = [
    {
      label: `Tamanho da amostra: ${input.sampleSize} (mínimo ${input.minSampleSize})`,
      value: round2(sampleFactor),
      weight: WEIGHTS.sample,
    },
    {
      label: `Magnitude do efeito: ${input.deltaPercent.toFixed(1)}% (mínimo ${input.minDeltaPercent}%)`,
      value: round2(effectFactor),
      weight: WEIGHTS.effect,
    },
    {
      label: `Atualidade do dado: há ${input.recencyHours.toFixed(1)}h`,
      value: round2(recencyFactor),
      weight: WEIGHTS.recency,
    },
  ];

  const score = round2(sampleFactor * WEIGHTS.sample + effectFactor * WEIGHTS.effect + recencyFactor * WEIGHTS.recency);
  const level: ConfidenceResult["level"] = score >= 0.75 ? "alta" : score >= 0.5 ? "média" : "baixa";

  return { score, level, factors };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
