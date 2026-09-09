import type { CampaignType, TargetScope } from "@/generated/prisma/client";
import { scopeSpecificityRank } from "@/domain/campaign/assignment";

/**
 * A lightweight, dashboard-only preview of "what would this table show right
 * now" — reusing the same specificity→priority→recency ordering the real
 * Campaign Resolution Engine uses (scopeSpecificityRank, same tie-break
 * order), but deliberately NOT re-implementing the engine itself: no rule
 * evaluation (day/time/device), no A/B variant selection, no cache. Those
 * depend on request-scoped context (current time, device, which visitor)
 * that doesn't exist for a static admin visualization — see ADR-019. Good
 * enough to answer "which tables have active campaigns" and "do any tables
 * have competing assignments," which is what the Table Map needs today; not
 * a source of truth for what a customer will actually see.
 */

export interface TableStatusAssignment {
  campaignId: string;
  campaignName: string;
  campaignType: CampaignType;
  priority: number;
  scope: TargetScope;
  organizationId: string | null;
  branchId: string | null;
  zoneId: string | null;
  cardId: string | null;
  /** Epoch milliseconds, not a `Date` — this crosses the server/client
   * boundary and gets synthesized for optimistic updates (`Date.now()`) on
   * the client after a drag-drop assignment, so a plain number is simpler
   * than reasoning about Date identity/serialization on both sides. */
  createdAt: number;
}

export interface TableStatusCard {
  id: string;
  branchId: string | null;
  zoneId: string | null;
}

export interface TableStatus {
  campaignId: string;
  campaignName: string;
  campaignType: CampaignType;
  /** True when 2+ assignments tie at the same specificity AND the same
   * priority — a genuinely ambiguous setup worth surfacing to the merchant,
   * even though the real engine would still deterministically pick one
   * (by recency) rather than actually failing. */
  hasConflict: boolean;
  /** How many active assignments apply to this table at all (>=1 when a
   * status exists) — shown in a tooltip alongside the conflict badge. */
  competingCount: number;
}

function appliesToCard(a: TableStatusAssignment, card: TableStatusCard, organizationId: string | null): boolean {
  if (a.scope === "ORGANIZATION") return organizationId !== null && a.organizationId === organizationId;
  if (a.scope === "COMPANY") return true;
  if (a.scope === "BRANCH") return card.branchId !== null && a.branchId === card.branchId;
  if (a.scope === "ZONE") return card.zoneId !== null && a.zoneId === card.zoneId;
  return a.cardId === card.id;
}

/** One card's status, or `null` when no active campaign applies to it (falls
 * back to the legacy review flow, same as the real engine's default). */
export function computeTableStatus(
  card: TableStatusCard,
  assignments: TableStatusAssignment[],
  organizationId: string | null
): TableStatus | null {
  const eligible = assignments.filter((a) => appliesToCard(a, card, organizationId));
  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => {
    const specificity = scopeSpecificityRank(b.scope) - scopeSpecificityRank(a.scope);
    if (specificity !== 0) return specificity;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.createdAt - a.createdAt;
  });

  const winner = sorted[0];
  const topSpecificity = scopeSpecificityRank(winner.scope);
  const tiedAtTop = sorted.filter((a) => scopeSpecificityRank(a.scope) === topSpecificity && a.priority === winner.priority);

  return {
    campaignId: winner.campaignId,
    campaignName: winner.campaignName,
    campaignType: winner.campaignType,
    hasConflict: tiedAtTop.length > 1,
    competingCount: eligible.length,
  };
}

/** Batch version — computes every card's status in one pass instead of
 * O(cards × assignments) re-filtering per card from scratch each time a
 * component re-renders (still O(cards × assignments) once, but memoized by
 * the caller via useMemo on the same input references). */
export function computeAllTableStatuses(
  cards: TableStatusCard[],
  assignments: TableStatusAssignment[],
  organizationId: string | null
): Map<string, TableStatus | null> {
  const result = new Map<string, TableStatus | null>();
  for (const card of cards) {
    result.set(card.id, computeTableStatus(card, assignments, organizationId));
  }
  return result;
}
