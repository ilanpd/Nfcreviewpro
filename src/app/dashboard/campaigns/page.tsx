import { Megaphone } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { listCampaigns } from "@/services/campaign.service";
import { listBranches } from "@/services/branch.service";
import { listZones } from "@/services/zone.service";
import { listCards } from "@/services/card.service";
import { listMembers } from "@/services/team.service";
import { roleHasPermission } from "@/domain/rbac/roles";
import { planHasFeature, minimumPlanForFeature } from "@/lib/plans";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { CampaignsView } from "@/components/dashboard/campaigns/campaigns-view";

/** Fase 20 — Campanhas customizadas são Pro+ (`planHasFeature`,
 * `lib/plans.ts`). Sem nenhuma campanha configurada, o motor de resolução
 * já cai no fallback padrão (redirect pro Google) — Starter entrega o valor
 * central do produto de qualquer forma, só não pode customizar o destino. */
export default async function CampaignsPage() {
  const ctx = await requireAuthContext();

  if (!planHasFeature(ctx.plan, "campaigns")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Customize para onde cada cartão redireciona, por mesa, zona ou horário.</p>
        </div>
        <PlanUpsell
          icon={<Megaphone />}
          featureLabel="Campanhas customizadas"
          requiredPlan={minimumPlanForFeature("campaigns")}
          currentPlan={ctx.plan}
        />
      </div>
    );
  }

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
