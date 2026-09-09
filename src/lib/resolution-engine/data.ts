import "server-only";
import { prisma } from "@/lib/prisma";
import type { RedirectOutcome } from "@/generated/prisma/client";
import type { CampaignAssignmentSnapshot, PublicCardInfo, PublicCompanyInfo, RuleTraceEntry } from "./types";

// Raw Prisma reads only — no decision logic here (see resolve.ts). This
// deliberately does NOT reuse card.service.ts's getActiveCardByCode: the
// resolution engine must stay decoupled from the dashboard's service layer
// so a future public API/QR caller can import it standalone. The tradeoff
// is one duplicated (cheap, indexed) query — see ROADMAP risk notes.

export async function loadCardMeta(uniqueCode: string): Promise<PublicCardInfo | null> {
  const card = await prisma.nFCCard.findFirst({
    where: { uniqueCode, active: true },
    select: { id: true, companyId: true, uniqueCode: true, branchId: true, zoneId: true },
  });
  return card;
}

export async function loadCompanyInfo(companyId: string): Promise<PublicCompanyInfo | null> {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      googleReviewUrl: true,
      whatsapp: true,
      timezone: true,
    },
  });
}

/**
 * All eligible-by-status campaign assignments for a company — every scope
 * (COMPANY/BRANCH/ZONE/CARD), across every card/branch/zone in the company,
 * each with its rules and A/B variants nested in the same query (no N+1).
 * Cached as one blob per company (see cache.ts); callers filter down to the
 * assignments relevant to a specific card.
 */
export async function loadCompanyCampaigns(companyId: string): Promise<CampaignAssignmentSnapshot[]> {
  const assignments = await prisma.campaignAssignment.findMany({
    where: { companyId, campaign: { status: "ACTIVE" } },
    select: {
      cardId: true,
      zoneId: true,
      branchId: true,
      scope: true,
      campaign: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          priority: true,
          startsAt: true,
          endsAt: true,
          config: true,
          recurrenceType: true,
          recurrenceConfig: true,
          createdAt: true,
          rules: { select: { id: true, type: true, config: true } },
          variants: { select: { id: true, weight: true, config: true } },
        },
      },
    },
  });

  return assignments.map((a) => ({
    campaignId: a.campaign.id,
    campaignName: a.campaign.name,
    type: a.campaign.type,
    status: a.campaign.status,
    priority: a.campaign.priority,
    startsAt: a.campaign.startsAt,
    endsAt: a.campaign.endsAt,
    config: a.campaign.config,
    recurrenceType: a.campaign.recurrenceType,
    recurrenceConfig: a.campaign.recurrenceConfig,
    rules: a.campaign.rules,
    variants: a.campaign.variants,
    scope: a.scope,
    branchId: a.branchId,
    zoneId: a.zoneId,
    cardId: a.cardId,
    createdAt: a.campaign.createdAt,
  }));
}

/**
 * The one query in the whole resolution engine that intentionally crosses
 * company boundaries: an ORGANIZATION-scope assignment must resolve for
 * every card in every company under that organization, not just the
 * company that created it. Filtered by `organizationId`, never `companyId`
 * — see the CampaignAssignment model comment and ADR-013. Cached under its
 * own key (resolutionCacheKeys.organizationCampaigns) so invalidating it
 * never requires enumerating member companies.
 */
export async function loadOrganizationCampaigns(organizationId: string): Promise<CampaignAssignmentSnapshot[]> {
  const assignments = await prisma.campaignAssignment.findMany({
    where: { organizationId, scope: "ORGANIZATION", campaign: { status: "ACTIVE" } },
    select: {
      cardId: true,
      zoneId: true,
      branchId: true,
      scope: true,
      campaign: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          priority: true,
          startsAt: true,
          endsAt: true,
          config: true,
          recurrenceType: true,
          recurrenceConfig: true,
          createdAt: true,
          rules: { select: { id: true, type: true, config: true } },
          variants: { select: { id: true, weight: true, config: true } },
        },
      },
    },
  });

  return assignments.map((a) => ({
    campaignId: a.campaign.id,
    campaignName: a.campaign.name,
    type: a.campaign.type,
    status: a.campaign.status,
    priority: a.campaign.priority,
    startsAt: a.campaign.startsAt,
    endsAt: a.campaign.endsAt,
    config: a.campaign.config,
    recurrenceType: a.campaign.recurrenceType,
    recurrenceConfig: a.campaign.recurrenceConfig,
    rules: a.campaign.rules,
    variants: a.campaign.variants,
    scope: a.scope,
    branchId: a.branchId,
    zoneId: a.zoneId,
    cardId: a.cardId,
    createdAt: a.campaign.createdAt,
  }));
}

interface RedirectLogInput {
  companyId: string;
  cardId: string;
  campaignId: string | null;
  variantId: string | null;
  outcome: RedirectOutcome;
  resolvedFromCache: boolean;
}

/** Best-effort audit write — called via next/server's after(), never on the
 * response path. See the RedirectLog model comment for why NOT_FOUND is
 * never logged here. */
export async function createRedirectLog(input: RedirectLogInput) {
  await prisma.redirectLog.create({ data: input });
}

/**
 * One row per candidate campaign that actually had rules attached (see the
 * RuleExecutionLog model comment for why this stays bounded rather than
 * logging every rule individually). Best-effort, via after() — never on the
 * response path.
 */
export async function createRuleExecutionLogs(companyId: string, cardId: string, trace: RuleTraceEntry[]) {
  if (trace.length === 0) return;
  await prisma.ruleExecutionLog.createMany({
    data: trace.map((entry) => ({
      companyId,
      cardId,
      campaignId: entry.campaignId,
      passed: entry.passed,
      ruleResults: entry.results,
    })),
  });
}
