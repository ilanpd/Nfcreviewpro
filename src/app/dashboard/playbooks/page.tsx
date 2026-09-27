import { Wand2 } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { roleHasPermission } from "@/domain/rbac/roles";
import { planHasFeature, minimumPlanForFeature } from "@/lib/plans";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { listRecommendations } from "@/services/recommendation-engine.service";
import { getAutoPilotSetting } from "@/services/automation-engine.service";
import { PlaybooksView } from "@/components/dashboard/playbooks/playbooks-view";

/**
 * Recommendation Center (Fase 11) — `/dashboard/playbooks`. Visível a
 * qualquer papel autenticado (observar recomendações não é sensível); só
 * aplicar/ignorar exige "campaign:assign" e só mudar o AutoPilot exige
 * "automation:manage" — o mesmo padrão de exibir tudo e restringir a AÇÃO
 * (não a tela inteira) já usado em `/dashboard/campaigns`.
 *
 * Fase 20 — Playbooks/Automação é Pro+ (`planHasFeature`, `lib/plans.ts`):
 * aqui sim a tela inteira é gated, porque sem Campanhas (também Pro+) não
 * existe nada real pra recomendar.
 */
export default async function PlaybooksPage() {
  const ctx = await requireAuthContext();

  if (!planHasFeature(ctx.plan, "automation")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Playbooks</h1>
          <p className="text-sm text-muted-foreground">Recomendações automáticas geradas a partir do seu próprio dado.</p>
        </div>
        <PlanUpsell
          icon={<Wand2 />}
          featureLabel="Playbooks e automação"
          requiredPlan={minimumPlanForFeature("automation")}
          currentPlan={ctx.plan}
        />
      </div>
    );
  }

  const [recommendations, autoPilotLevel] = await Promise.all([
    listRecommendations(ctx.companyId),
    getAutoPilotSetting(ctx.companyId),
  ]);

  return (
    <PlaybooksView
      initialRecommendations={recommendations}
      autoPilotLevel={autoPilotLevel}
      canApply={roleHasPermission(ctx.role, "campaign:assign")}
      canManageAutomation={roleHasPermission(ctx.role, "automation:manage")}
    />
  );
}
