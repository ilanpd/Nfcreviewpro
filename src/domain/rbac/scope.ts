/**
 * Pure access-scope check — "is this user allowed to act on this target,
 * given their restriction rows (if any)." Zero restriction rows means
 * unrestricted (the default for every user before Phase 4, and every user
 * Phase 4 doesn't explicitly restrict) — this function returning `true` for
 * an empty restriction list is the backward-compatibility guarantee, not an
 * edge case to special-case elsewhere.
 */

export interface ScopeRestriction {
  branchId: string | null;
  zoneId: string | null;
}

export interface ScopeTargetCheck {
  /** The branch a target belongs to (a card/zone's own branchId), if any. */
  branchId?: string | null;
  /** The zone a target belongs to (a card's own zoneId, or a zone's own id), if any. */
  zoneId?: string | null;
}

/**
 * A branch-level restriction implies access to every zone under that
 * branch — a manager scoped to "Shopping Barra" shouldn't need a second,
 * separate grant for "Shopping Barra > VIP." A zone-level restriction only
 * covers that one zone, not its sibling zones or its parent branch.
 */
export function isWithinScope(restrictions: ScopeRestriction[], target: ScopeTargetCheck): boolean {
  if (restrictions.length === 0) return true;

  return restrictions.some((r) => {
    if (r.branchId && target.branchId && r.branchId === target.branchId) return true;
    if (r.zoneId && target.zoneId && r.zoneId === target.zoneId) return true;
    return false;
  });
}
