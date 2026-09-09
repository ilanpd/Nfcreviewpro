export interface VariantLike {
  id: string;
  weight: number;
  config: unknown;
}

export interface VariantPick {
  variantId: string | null;
  config: unknown;
}

/**
 * Weighted-random selection — "distribuição configurável." No variants means
 * no A/B test: returns the campaign's own base config untouched, exactly
 * Phase 1/2 behavior, so every existing campaign keeps working unchanged.
 * Weights need not sum to 100 (a 1/1 split is as valid as 50/50); zero or
 * negative total weight falls back to the first variant rather than
 * dividing by zero.
 *
 * `random` is injectable for deterministic unit tests — defaults to
 * Math.random for real traffic.
 */
export function pickVariant(baseConfig: unknown, variants: VariantLike[], random: () => number = Math.random): VariantPick {
  if (variants.length === 0) return { variantId: null, config: baseConfig };

  const totalWeight = variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
  if (totalWeight <= 0) return { variantId: variants[0].id, config: variants[0].config };

  let roll = random() * totalWeight;
  for (const variant of variants) {
    roll -= Math.max(0, variant.weight);
    if (roll <= 0) return { variantId: variant.id, config: variant.config };
  }

  // Floating-point rounding safety net — should be unreachable in practice.
  const last = variants[variants.length - 1];
  return { variantId: last.id, config: last.config };
}
