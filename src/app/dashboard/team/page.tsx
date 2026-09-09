import { requireAuthContext } from "@/lib/auth";
import { listMembers } from "@/services/team.service";
import { listBranches } from "@/services/branch.service";
import { listZones } from "@/services/zone.service";
import { roleHasPermission } from "@/domain/rbac/roles";
import { TeamView } from "@/components/dashboard/team-view";

export default async function TeamPage() {
  const ctx = await requireAuthContext();
  const [members, branches, zones] = await Promise.all([
    listMembers(ctx.companyId),
    listBranches(ctx.companyId),
    listZones(ctx.companyId),
  ]);

  return (
    <TeamView
      initialMembers={members}
      canManage={roleHasPermission(ctx.role, "team:write")}
      currentUserId={ctx.userId}
      branches={branches}
      zones={zones}
    />
  );
}
