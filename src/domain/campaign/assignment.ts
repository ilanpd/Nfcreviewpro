import type { TargetScope } from "@/generated/prisma/client";

/** CARD > ZONE > BRANCH > COMPANY > ORGANIZATION — must match resolution-engine/
 * resolve.ts's compareBySpecificityThenPriorityThenRecency exactly, since
 * that's the function whose behavior this ranking documents/mirrors for the
 * dashboard (e.g. to explain to a merchant why one assignment wins over
 * another). ORGANIZATION is least specific: it's the "applies everywhere in
 * the franchise unless something more specific overrides it" tier. */
export function scopeSpecificityRank(scope: TargetScope): number {
  switch (scope) {
    case "CARD":
      return 4;
    case "ZONE":
      return 3;
    case "BRANCH":
      return 2;
    case "COMPANY":
      return 1;
    case "ORGANIZATION":
      return 0;
  }
}

export const SCOPE_LABEL: Record<TargetScope, string> = {
  ORGANIZATION: "Toda a organização",
  COMPANY: "Empresa inteira",
  BRANCH: "Unidade",
  ZONE: "Zona",
  CARD: "Cartão específico",
};

export interface ScopeTarget {
  organizationId?: string | null;
  branchId?: string | null;
  zoneId?: string | null;
  cardId?: string | null;
}

/**
 * Pure invariant check: exactly the target field matching `scope` must be
 * set, and no others. The actual "at most one COMPANY-scope assignment per
 * campaign" rule needs a database round-trip (see campaign.service.ts's
 * Serializable transaction) and can't live here — this only validates shape.
 */
export function validateScopeTarget(scope: TargetScope, target: ScopeTarget): string | null {
  const { organizationId, branchId, zoneId, cardId } = target;
  const setFields = [organizationId, branchId, zoneId, cardId].filter((v) => v != null).length;

  if (scope === "COMPANY") {
    return setFields === 0 ? null : "Escopo de empresa não deve informar organização, unidade, zona ou cartão";
  }
  if (scope === "ORGANIZATION") {
    return organizationId && setFields === 1 ? null : "Escopo de organização exige exatamente um organizationId";
  }
  if (scope === "BRANCH") {
    return branchId && setFields === 1 ? null : "Escopo de unidade exige exatamente um branchId";
  }
  if (scope === "ZONE") {
    return zoneId && setFields === 1 ? null : "Escopo de zona exige exatamente um zoneId";
  }
  // CARD
  return cardId && setFields === 1 ? null : "Escopo de cartão exige exatamente um cardId";
}
