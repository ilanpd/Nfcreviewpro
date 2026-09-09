import { requireAuthContext } from "@/lib/auth";
import { roleHasPermission } from "@/domain/rbac/roles";
import { listApiKeys } from "@/services/api-key.service";
import { listWebhookEndpoints } from "@/services/webhook-endpoint.service";
import { listApiRequestLogs, getApiUsageSummary } from "@/services/api-request-log.service";
import { DevelopersView } from "@/components/dashboard/developers/developers-view";
import { EmptyState } from "@nfc-os/ui";
import { Lock } from "lucide-react";

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
