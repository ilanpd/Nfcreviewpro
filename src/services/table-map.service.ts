import "server-only";
import { prisma } from "@/lib/prisma";
import * as campaignRepo from "@/repositories/campaign.repository";
import type { TableStatusAssignment } from "@/domain/table-map/status";

/** Cards with their Table Map layout, ordered so unplaced tables (no
 * layoutX/Y yet) sort last rather than interleaved with placed ones. */
export function listCardsForMap(companyId: string) {
  return prisma.nFCCard.findMany({
    where: { companyId },
    orderBy: [{ layoutY: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
}

/** Active campaigns available to drag onto the canvas — id/name/type/priority
 * only, not the full CampaignListItem shape (the tray doesn't need config,
 * description, counts, etc.). */
export function listActiveCampaignsForMap(companyId: string) {
  return prisma.campaign.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { id: true, name: true, type: true, priority: true },
    orderBy: { priority: "desc" },
  });
}

export async function listAssignmentsForStatus(companyId: string, organizationId: string | null): Promise<TableStatusAssignment[]> {
  const rows = await campaignRepo.findActiveAssignmentsForStatus(companyId, organizationId);
  return rows.map((r) => ({
    campaignId: r.campaign.id,
    campaignName: r.campaign.name,
    campaignType: r.campaign.type,
    priority: r.campaign.priority,
    scope: r.scope,
    organizationId: r.organizationId,
    branchId: r.branchId,
    zoneId: r.zoneId,
    cardId: r.cardId,
    createdAt: r.campaign.createdAt.getTime(),
  }));
}
