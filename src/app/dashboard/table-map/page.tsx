import { requireAuthContext } from "@/lib/auth";
import { listBranches } from "@/services/branch.service";
import { listZones } from "@/services/zone.service";
import { listCardsForMap, listActiveCampaignsForMap, listAssignmentsForStatus } from "@/services/table-map.service";
import { roleHasPermission } from "@/domain/rbac/roles";
import { TableMapView } from "@/components/dashboard/table-map/table-map-view";

export default async function TableMapPage() {
  const ctx = await requireAuthContext();

  const [cards, zones, branches, campaigns, assignments] = await Promise.all([
    listCardsForMap(ctx.companyId),
    listZones(ctx.companyId),
    listBranches(ctx.companyId),
    listActiveCampaignsForMap(ctx.companyId),
    listAssignmentsForStatus(ctx.companyId, ctx.organizationId),
  ]);

  return (
    <TableMapView
      initialCards={cards}
      zones={zones}
      branches={branches}
      campaigns={campaigns}
      initialAssignments={assignments}
      organizationId={ctx.organizationId}
      canEditLayout={roleHasPermission(ctx.role, "card:write")}
      canAssign={roleHasPermission(ctx.role, "campaign:assign")}
    />
  );
}
