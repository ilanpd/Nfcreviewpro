import { scopeSpecificityRank } from "@/domain/campaign/assignment";
import { isEligibleStatus } from "@/domain/campaign/status";
import { evaluateRuleSet } from "@/domain/rules/evaluate";
import { buildRecurrenceRules } from "@/domain/rules/recurrence";
import { pickVariant as pickWeightedVariant } from "@/domain/rules/variants";
import type { CampaignAssignmentSnapshot, ResolutionContext, ResolutionDecision, RuleTraceEntry } from "./types";

export interface ResolveResult {
  decision: ResolutionDecision;
  /** Only populated for candidates that actually had rules (own + recurrence-
   * derived) — see the RuleExecutionLog model for why volume stays bounded. */
  ruleTrace: RuleTraceEntry[];
}

/**
 * Pure decision function — no I/O, unit-testable with hand-built contexts.
 * Given everything relevant to one card (already filtered to that card's
 * COMPANY/BRANCH/ZONE/CARD-scope assignments), evaluates each candidate's
 * rules (own + recurrence-derived), picks the winning campaign by
 * specificity/priority/recency, selects an A/B variant if any exist, or
 * falls back to the legacy review flow.
 */
export function resolveDecision(ctx: ResolutionContext, now: Date): ResolveResult {
  const ruleTrace: RuleTraceEntry[] = [];
  const ruleCtx = { now, timezone: ctx.company.timezone, deviceType: ctx.deviceType };

  const eligible = ctx.assignments
    .filter((a) => isEligibleStatus(a.status))
    .filter((a) => withinWindow(a, now))
    .filter((a) => {
      const rules = [...a.rules, ...buildRecurrenceRules(a.campaignId, a)];
      if (rules.length === 0) return true;

      const { passed, results } = evaluateRuleSet(rules, ruleCtx);
      ruleTrace.push({ campaignId: a.campaignId, passed, results });
      return passed;
    })
    .sort(compareBySpecificityThenPriorityThenRecency);

  const winner = eligible[0];
  if (!winner) {
    return { decision: { outcome: "REVIEW_FLOW_FALLBACK", card: ctx.card, company: ctx.company }, ruleTrace };
  }

  const { variantId, config } = pickWeightedVariant(winner.config, winner.variants);

  return {
    decision: {
      outcome: "CAMPAIGN",
      campaignId: winner.campaignId,
      campaignName: winner.campaignName,
      type: winner.type,
      config,
      variantId,
      card: ctx.card,
      company: ctx.company,
    },
    ruleTrace,
  };
}

function withinWindow(a: CampaignAssignmentSnapshot, now: Date): boolean {
  if (a.startsAt && now < a.startsAt) return false;
  if (a.endsAt && now > a.endsAt) return false;
  return true;
}

function compareBySpecificityThenPriorityThenRecency(
  a: CampaignAssignmentSnapshot,
  b: CampaignAssignmentSnapshot
): number {
  const specificity = scopeSpecificityRank(b.scope) - scopeSpecificityRank(a.scope);
  if (specificity !== 0) return specificity;
  if (b.priority !== a.priority) return b.priority - a.priority;
  return b.createdAt.getTime() - a.createdAt.getTime();
}
