import type { RuleType } from "@/generated/prisma/client";
import { getLocalDateParts } from "./timezone";

export type DeviceCategory = "mobile" | "tablet" | "desktop" | string;

export interface RuleCheckContext {
  now: Date;
  timezone: string;
  deviceType: DeviceCategory | null;
}

export interface RuleLike {
  id: string;
  type: RuleType;
  config: unknown;
}

export interface RuleCheckResult {
  ruleId: string;
  type: RuleType;
  passed: boolean;
}

/** Pure, no I/O — every branch reads only its inputs. Malformed config
 * (wrong shape from a hand-edited row) fails closed (rule doesn't pass)
 * rather than throwing, so one bad rule can't crash the public redirect. */
export function evaluateRule(rule: RuleLike, ctx: RuleCheckContext): boolean {
  const config = rule.config;
  if (typeof config !== "object" || config === null) return false;
  const c = config as Record<string, unknown>;

  switch (rule.type) {
    case "DAY_OF_WEEK": {
      const days = c.days;
      if (!Array.isArray(days)) return false;
      const { weekday } = getLocalDateParts(ctx.now, ctx.timezone);
      return days.includes(weekday);
    }

    case "TIME_WINDOW": {
      const start = typeof c.startTime === "string" ? c.startTime : null;
      const end = typeof c.endTime === "string" ? c.endTime : null;
      if (!start || !end) return false;
      const { hour, minute } = getLocalDateParts(ctx.now, ctx.timezone);
      const nowMinutes = hour * 60 + minute;
      const startMinutes = toMinutes(start);
      const endMinutes = toMinutes(end);
      if (startMinutes === null || endMinutes === null) return false;
      // Overnight windows (e.g. 22:00-02:00) wrap past midnight.
      if (startMinutes <= endMinutes) {
        return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
      }
      return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
    }

    case "DATE_RANGE": {
      const start = typeof c.startDate === "string" ? c.startDate : null;
      const end = typeof c.endDate === "string" ? c.endDate : null;
      if (!start || !end) return false;
      const { isoDate } = getLocalDateParts(ctx.now, ctx.timezone);
      return isoDate >= start && isoDate <= end;
    }

    case "DEVICE_TYPE": {
      const devices = c.devices;
      if (!Array.isArray(devices) || !ctx.deviceType) return false;
      return devices.includes(ctx.deviceType);
    }

    default:
      return false;
  }
}

function toMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Runs every rule for a candidate and combines them with AND (all must
 * pass) — a deliberate Phase 3 simplification; see the Rule model comment. */
export function evaluateRuleSet(rules: RuleLike[], ctx: RuleCheckContext): { passed: boolean; results: RuleCheckResult[] } {
  const results = rules.map((rule) => ({ ruleId: rule.id, type: rule.type, passed: evaluateRule(rule, ctx) }));
  return { passed: results.every((r) => r.passed), results };
}
