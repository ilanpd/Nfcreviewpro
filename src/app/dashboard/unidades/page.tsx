import { MapPin } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { listBranches } from "@/services/branch.service";
import { listZones } from "@/services/zone.service";
import { roleHasPermission } from "@/domain/rbac/roles";
import { planHasFeature, minimumPlanForFeature } from "@/lib/plans";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { BranchZoneManager } from "./branch-zone-manager";

/**
 * Motor de Ativação (Fase 18, achado na revisão noturna) — desde a Fase 4,
 * `Branch`/`Zone` têm schema, serviços, API pública e RBAC completos, e o
 * plano Business anuncia "Múltiplas unidades" como diferencial — mas nunca
 * existiu uma tela no próprio Dashboard para criar uma unidade ou zona. Um
 * cliente Business só conseguiria usar isso chamando a API pública na mão.
 * Esta página fecha essa lacuna (ver comentário de zone.service.ts's
 * updateZone, que já registrava o problema desde a Fase 9).
 *
 * Fase 20 — o gate `plan !== "BUSINESS"` virou `planHasFeature(ctx.plan,
 * "multi_branch")`, única fonte de verdade compartilhada com o resto do
 * sistema de entitlements (`lib/plans.ts`).
 */
export default async function UnidadesPage() {
  const ctx = await requireAuthContext();

  if (!planHasFeature(ctx.plan, "multi_branch")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Unidades e zonas</h1>
          <p className="text-sm text-muted-foreground">Organize campanhas por unidade física ou por zona dentro dela.</p>
        </div>
        <PlanUpsell
          icon={<MapPin />}
          featureLabel="Múltiplas unidades"
          requiredPlan={minimumPlanForFeature("multi_branch")}
          currentPlan={ctx.plan}
        />
      </div>
    );
  }

  const [branches, zones] = await Promise.all([listBranches(ctx.companyId), listZones(ctx.companyId)]);
  const canManage = roleHasPermission(ctx.role, "settings:write");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unidades e zonas</h1>
        <p className="text-sm text-muted-foreground">
          Unidades são locais físicos separados (ex: duas lojas); zonas são setores dentro de um local (ex: Varanda,
          VIP). Cartões e campanhas podem ser organizados por qualquer um dos dois níveis.
        </p>
      </div>
      <BranchZoneManager initialBranches={branches} initialZones={zones} canManage={canManage} />
    </div>
  );
}
