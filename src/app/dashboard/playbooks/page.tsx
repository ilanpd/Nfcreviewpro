import { requireAuthContext } from "@/lib/auth";
import { roleHasPermission } from "@/domain/rbac/roles";
import { listRecommendations } from "@/services/recommendation-engine.service";
import { getAutoPilotSetting } from "@/services/automation-engine.service";
import { PlaybooksView } from "@/components/dashboard/playbooks/playbooks-view";

/**
 * Recommendation Center (Fase 11) — `/dashboard/playbooks`. Visível a
 * qualquer papel autenticado (observar recomendações não é sensível); só
 * aplicar/ignorar exige "campaign:assign" e só mudar o AutoPilot exige
 * "automation:manage" — o mesmo padrão de exibir tudo e restringir a AÇÃO
 * (não a tela inteira) já usado em `/dashboard/campaigns`.
 */
export default async function PlaybooksPage() {
  const ctx = await requireAuthContext();

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
