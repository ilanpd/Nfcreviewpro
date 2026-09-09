import type { HeatmapCellIntensity, HeatmapRawCount } from "./types";

/**
 * Normaliza contagens brutas (de qualquer camada baseada em contagem —
 * Aproximações/Conversões/Google/Instagram) em intensidade 0-1, relativa ao
 * maior valor do conjunto — a mesma abordagem já usada pelo Heatmap Card de
 * packages/ui (Fase 4.5), reaproveitada aqui, não duplicada com uma escala
 * diferente.
 */
export function normalizeCounts(counts: HeatmapRawCount[]): HeatmapCellIntensity[] {
  const max = Math.max(1, ...counts.map((c) => c.count));
  return counts.map((c) => ({ cardId: c.cardId, intensity: c.count / max, rawValue: c.count }));
}

const RECENCY_BUCKETS: { withinMs: number; intensity: number }[] = [
  { withinMs: 5 * 60_000, intensity: 1 },
  { withinMs: 30 * 60_000, intensity: 0.7 },
  { withinMs: 2 * 60 * 60_000, intensity: 0.4 },
  { withinMs: 24 * 60 * 60_000, intensity: 0.15 },
];

/** Camada "Última interação" não é uma contagem — é recência. Decai em
 * degraus (não uma curva contínua) de propósito: a diferença perceptível
 * entre "há 3 minutos" e "há 4 minutos" não deveria existir visualmente, só
 * a diferença entre janelas de tempo que um gerente realmente reconhece
 * ("agora", "há pouco", "há um tempo", "hoje mais cedo"). */
export function intensityFromRecency(lastInteractionAt: Date, now: Date): number {
  const ageMs = now.getTime() - lastInteractionAt.getTime();
  for (const bucket of RECENCY_BUCKETS) {
    if (ageMs <= bucket.withinMs) return bucket.intensity;
  }
  return 0.05;
}
