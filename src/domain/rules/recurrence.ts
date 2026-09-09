import type { RecurrenceType } from "@/generated/prisma/client";
import type { RuleLike } from "./evaluate";

export interface RecurrenceLike {
  recurrenceType: RecurrenceType;
  recurrenceConfig: unknown;
}

/**
 * Translates a Campaign's recurrenceType/recurrenceConfig (captured by the
 * Phase 2 Builder) into synthetic Rule-shaped entries, so recurrence is
 * enforced through the exact same evaluateRuleSet() path as a merchant's own
 * Rule rows — one evaluation engine, not two. DAILY only needs a
 * TIME_WINDOW; WEEKLY adds a DAY_OF_WEEK check ahead of it. NONE produces no
 * rules at all, so a campaign without recurrence is unaffected.
 */
export function buildRecurrenceRules(campaignId: string, recurrence: RecurrenceLike): RuleLike[] {
  if (recurrence.recurrenceType === "NONE") return [];

  const config = (recurrence.recurrenceConfig ?? {}) as {
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
  };

  const rules: RuleLike[] = [];

  if (recurrence.recurrenceType === "WEEKLY" && config.daysOfWeek?.length) {
    rules.push({
      id: `recurrence:${campaignId}:day`,
      type: "DAY_OF_WEEK",
      config: { days: config.daysOfWeek },
    });
  }

  if (config.startTime && config.endTime) {
    rules.push({
      id: `recurrence:${campaignId}:time`,
      type: "TIME_WINDOW",
      config: { startTime: config.startTime, endTime: config.endTime },
    });
  }

  return rules;
}
