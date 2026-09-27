import { LayoutGrid } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { listBranches } from "@/services/branch.service";
import { listZones } from "@/services/zone.service";
import { listCardsForMap, listActiveCampaignsForMap, listAssignmentsForStatus } from "@/services/table-map.service";
import { roleHasPermission } from "@/domain/rbac/roles";
import { planHasFeature, minimumPlanForFeature } from "@/lib/plans";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { TableMapView } from "@/components/dashboard/table-map/table-map-view";

// Toda escrita nesta página (mover mesa, renomear, atribuir campanha) passa
// por fetch()+setState no cliente, nunca por router.refresh() — de propósito,
// pra não re-buscar (e re-renderizar o canvas inteiro) a cada arrasto. Isso
// só é seguro se ESTA página nunca servir um HTML/RSC em cache de uma visita
// anterior depois de uma mutação (ex.: usuário navega pra Cartões e volta —
// ou aperta "voltar" do navegador — e vê a mesa na posição de ANTES do
// último arrasto, mesmo já salva no banco). `force-dynamic` garante isso:
// sempre busca os cards de novo no servidor a cada visita a esta rota.
export const dynamic = "force-dynamic";

/** Fase 20 — Mapa de Mesas é Pro+ (`planHasFeature`, `lib/plans.ts`): faz
 * pouco sentido pra uma empresa Starter com 1 cartão só. */
export default async function TableMapPage() {
  const ctx = await requireAuthContext();

  if (!planHasFeature(ctx.plan, "table_map")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mapa de Mesas</h1>
          <p className="text-sm text-muted-foreground">Posicione cartões visualmente e atribua campanhas por mesa.</p>
        </div>
        <PlanUpsell
          icon={<LayoutGrid />}
          featureLabel="O Mapa de Mesas"
          requiredPlan={minimumPlanForFeature("table_map")}
          currentPlan={ctx.plan}
        />
      </div>
    );
  }

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
