import "server-only";
import { prisma } from "@/lib/prisma";
import type { CampaignStatus, CampaignType, Prisma, TargetScope } from "@/generated/prisma/client";

// Raw Prisma access only — no business rules (uniqueness, cache
// invalidation, status transitions) live here. See services/campaign.service.ts
// for the layer that orchestrates those on top of this.

export interface CampaignListFilters {
  search?: string;
  status?: CampaignStatus;
  type?: CampaignType;
  sort?: "recent" | "priority" | "name";
}

export function findCampaigns(companyId: string, filters: CampaignListFilters) {
  const where: Prisma.CampaignWhereInput = {
    companyId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: "insensitive" as const } }
      : {}),
  };

  const orderBy: Prisma.CampaignOrderByWithRelationInput =
    filters.sort === "priority"
      ? { priority: "desc" }
      : filters.sort === "name"
        ? { name: "asc" }
        : { createdAt: "desc" };

  return prisma.campaign.findMany({
    where,
    orderBy,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { assignments: true, redirectLogs: true } },
    },
  });
}

export function findCampaignById(companyId: string, campaignId: string) {
  return prisma.campaign.findFirst({
    where: { id: campaignId, companyId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      assignments: {
        include: {
          branch: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
          card: { select: { id: true, name: true, uniqueCode: true } },
        },
      },
    },
  });
}

export function createCampaign(companyId: string, data: Omit<Prisma.CampaignUncheckedCreateInput, "companyId">) {
  return prisma.campaign.create({ data: { ...data, companyId } });
}

export function updateCampaign(campaignId: string, data: Prisma.CampaignUncheckedUpdateInput) {
  return prisma.campaign.update({ where: { id: campaignId }, data });
}

export function deleteCampaign(campaignId: string) {
  return prisma.campaign.delete({ where: { id: campaignId } });
}

export function findAssignments(companyId: string, campaignId: string) {
  return prisma.campaignAssignment.findMany({
    where: { companyId, campaignId },
    include: {
      branch: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
      card: { select: { id: true, name: true, uniqueCode: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export interface CreateAssignmentInput {
  companyId: string;
  campaignId: string;
  scope: TargetScope;
  branchId?: string | null;
  zoneId?: string | null;
  cardId?: string | null;
}

export function createAssignment(data: CreateAssignmentInput) {
  return prisma.campaignAssignment.create({ data });
}

export function deleteAssignment(companyId: string, assignmentId: string) {
  return prisma.campaignAssignment.deleteMany({ where: { id: assignmentId, companyId } });
}

export function findAssignmentById(companyId: string, assignmentId: string) {
  return prisma.campaignAssignment.findFirst({ where: { id: assignmentId, companyId } });
}

/**
 * Every active-campaign assignment across the whole company (or, for
 * ORGANIZATION scope, the whole organization) — used by the Table Map
 * (Phase 5) to compute a per-table status preview. Deliberately company-wide
 * rather than per-campaign like findAssignments above, and deliberately
 * flat (campaign fields inlined) rather than nested, matching the shape
 * domain/table-map/status.ts expects.
 */
export function findActiveAssignmentsForStatus(companyId: string, organizationId: string | null) {
  return prisma.campaignAssignment.findMany({
    where: {
      campaign: { status: "ACTIVE" },
      OR: [{ companyId }, ...(organizationId ? [{ organizationId }] : [])],
    },
    select: {
      scope: true,
      organizationId: true,
      branchId: true,
      zoneId: true,
      cardId: true,
      campaign: { select: { id: true, name: true, type: true, priority: true, createdAt: true } },
    },
  });
}

// --- Rules (Phase 3) ---

export function findRules(companyId: string, campaignId: string) {
  return prisma.rule.findMany({ where: { companyId, campaignId }, orderBy: { createdAt: "asc" } });
}

export function findRuleById(companyId: string, ruleId: string) {
  return prisma.rule.findFirst({ where: { id: ruleId, companyId } });
}

export function createRule(data: Prisma.RuleUncheckedCreateInput) {
  return prisma.rule.create({ data });
}

export function deleteRule(companyId: string, ruleId: string) {
  return prisma.rule.deleteMany({ where: { id: ruleId, companyId } });
}

// --- A/B variants (Phase 3) ---

export function findVariants(companyId: string, campaignId: string) {
  return prisma.campaignVariant.findMany({ where: { companyId, campaignId }, orderBy: { createdAt: "asc" } });
}

export function findVariantById(companyId: string, variantId: string) {
  return prisma.campaignVariant.findFirst({ where: { id: variantId, companyId } });
}

export function createVariant(data: Prisma.CampaignVariantUncheckedCreateInput) {
  return prisma.campaignVariant.create({ data });
}

export function deleteVariant(companyId: string, variantId: string) {
  return prisma.campaignVariant.deleteMany({ where: { id: variantId, companyId } });
}
