import { requireAuthContext } from "@/lib/auth";
import { listCampaigns } from "@/services/campaign.service";
import { listBranches } from "@/services/branch.service";
import { listZones } from "@/services/zone.service";
import { listCards } from "@/services/card.service";
import { listMembers } from "@/services/team.service";
import { roleHasPermission } from "@/domain/rbac/roles";
import { CampaignsView } from "@/components/dashboard/campaigns/campaigns-view";

export default async function CampaignsPage() {
  const ctx = await requireAuthContext();

  const [campaigns, branches, zones, cards, members] = await Promise.all([
    listCampaigns(ctx.companyId, {}),
    listBranches(ctx.companyId),
    listZones(ctx.companyId),
    listCards(ctx.companyId),
    listMembers(ctx.companyId),
  ]);

  return (
    <CampaignsView
      initialCampaigns={campaigns}
      branches={branches}
      zones={zones}
      cards={cards}
      members={members}
      organizationId={ctx.organizationId}
      canManage={roleHasPermission(ctx.role, "campaign:write")}
      canManageStructure={roleHasPermission(ctx.role, "settings:write")}
    />
  );
}
