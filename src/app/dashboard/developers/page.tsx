import { requireAuthContext } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { roleHasPermission } from "@/domain/rbac/roles";
import { planHasFeature, minimumPlanForFeature } from "@/lib/plans";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { listApiKeys } from "@/services/api-key.service";
import { listWebhookEndpoints } from "@/services/webhook-endpoint.service";
import { listApiRequestLogs, getApiUsageSummary } from "@/services/api-request-log.service";
import { DevelopersView } from "@/components/dashboard/developers/developers-view";
import { EmptyState } from "@nfc-os/ui";
import { Lock, Code2 } from "lucide-react";

/**
 * Dashboard de Desenvolvedor (Fase 9) — API Keys, Webhooks e Logs reais da
 * própria empresa. Restrito a `developers:manage` (só OWNER/ADMIN — ver
 * `domain/rbac/roles.ts`): uma ApiKey/WebhookEndpoint alcança tudo que seus
 * escopos permitem em toda a empresa, mais sensível que a maioria das
 * configurações.
 */
export default async function DevelopersPage() {
  const ctx = await requireAuthContext();

  if (!roleHasPermission(ctx.role, "developers:manage")) {
    return (
      <main className="p-6 sm:p-10">
        <EmptyState
          icon={<Lock />}
          title="Acesso restrito"
          description="Só Proprietários e Administradores podem gerenciar chaves de API e webhooks desta empresa."
        />
      </main>
    );
  }

  if (!planHasFeature(ctx.plan, "api_access")) {
    return (
      <main className="space-y-6 p-6 sm:p-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Desenvolvedores</h1>
          <p className="text-sm text-muted-foreground">Chaves de API e webhooks para integrar o {BRAND.name} a outros sistemas.</p>
        </div>
        <PlanUpsell
          icon={<Code2 />}
          featureLabel="API pública e Webhooks"
          requiredPlan={minimumPlanForFeature("api_access")}
          currentPlan={ctx.plan}
        />
      </main>
    );
  }

  const [apiKeys, webhooks, logs, summary] = await Promise.all([
    listApiKeys(ctx.companyId),
    listWebhookEndpoints(ctx.companyId),
    listApiRequestLogs(ctx.companyId),
    getApiUsageSummary(ctx.companyId),
  ]);

  return (
    <DevelopersView
      initialApiKeys={apiKeys}
      initialWebhooks={webhooks}
      initialLogs={logs}
      initialSummary={summary}
    />
  );
}
