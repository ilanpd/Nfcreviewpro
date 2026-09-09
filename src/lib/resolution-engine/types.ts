import type { CampaignStatus, CampaignType, RecurrenceType, RuleType, TargetScope } from "@/generated/prisma/client";
import type { DeviceCategory } from "@/domain/rules/evaluate";

export interface PublicCardInfo {
  id: string;
  companyId: string;
  uniqueCode: string;
  branchId: string | null;
  zoneId: string | null;
}

export interface PublicCompanyInfo {
  id: string;
  organizationId: string | null;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  googleReviewUrl: string;
  whatsapp: string;
  timezone: string;
}

export interface RuleSnapshot {
  id: string;
  type: RuleType;
  config: unknown;
}

export interface VariantSnapshot {
  id: string;
  weight: number;
  config: unknown;
}

/** A campaign + the single assignment that made it eligible for this card. */
export interface CampaignAssignmentSnapshot {
  campaignId: string;
  campaignName: string;
  type: CampaignType;
  status: CampaignStatus;
  priority: number;
  startsAt: Date | null;
  endsAt: Date | null;
  config: unknown;
  recurrenceType: RecurrenceType;
  recurrenceConfig: unknown;
  rules: RuleSnapshot[];
  variants: VariantSnapshot[];
  scope: TargetScope;
  branchId: string | null;
  zoneId: string | null;
  cardId: string | null;
  createdAt: Date;
}

export interface ResolutionContext {
  card: PublicCardInfo;
  company: PublicCompanyInfo;
  assignments: CampaignAssignmentSnapshot[];
  // Not `now` — that stays a separate resolveDecision(ctx, now) parameter
  // (unchanged since Phase 1) specifically so tests can inject a fixed
  // instant without also having to fake this whole context object.
  deviceType: DeviceCategory | null;
}

export type ResolutionDecision =
  | { outcome: "NOT_FOUND" }
  | { outcome: "REVIEW_FLOW_FALLBACK"; card: PublicCardInfo; company: PublicCompanyInfo }
  | {
      outcome: "CAMPAIGN";
      campaignId: string;
      campaignName: string;
      type: CampaignType;
      config: unknown;
      variantId: string | null;
      card: PublicCardInfo;
      company: PublicCompanyInfo;
    };

/** Per-candidate rule trace, for RuleExecutionLog — only populated for
 * campaigns that actually had rules attached (see resolve.ts). */
export interface RuleTraceEntry {
  campaignId: string;
  passed: boolean;
  results: { ruleId: string; type: RuleType; passed: boolean }[];
}
