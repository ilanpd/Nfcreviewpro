import { requireAuthContext } from "@/lib/auth";
import { getCompanyById } from "@/services/company.service";
import { getOrganization } from "@/services/organization.service";
import { listAuditLogs } from "@/services/audit.service";
import { roleHasPermission, ALL_ROLES, ALL_PERMISSIONS, ROLE_LABEL, PERMISSION_LABEL } from "@/domain/rbac/roles";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { RoiSettingsForm } from "@/components/dashboard/roi-settings-form";
import { OrganizationCard } from "@/components/dashboard/organization-card";
import { AuditLogCard } from "@/components/dashboard/audit-log-card";
import { PLANS } from "@/lib/plans";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsCard, PermissionMatrix } from "@nfc-os/ui";

export default async function SettingsPage() {
  const ctx = await requireAuthContext();
  const [company, organization] = await Promise.all([
    getCompanyById(ctx.companyId),
    ctx.organizationId ? getOrganization(ctx.organizationId) : Promise.resolve(null),
  ]);
  const plan = PLANS[company.plan];
  const canManageSettings = roleHasPermission(ctx.role, "settings:write");
  const canManageOrganization = roleHasPermission(ctx.role, "organization:write");
  const canReadAudit = roleHasPermission(ctx.role, "audit:read");
  const auditLogs = canReadAudit ? await listAuditLogs(ctx.companyId, 50) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie os dados públicos e o plano da sua empresa.</p>
      </div>

      <Card className="max-w-2xl border-none shadow-sm shadow-black/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Seu plano</CardTitle>
          <Badge>{plan.name}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {plan.priceLabel} · {plan.cardLimit === null ? "cartões ilimitados" : `até ${plan.cardLimit} cartão(ões)`}
        </CardContent>
      </Card>

      {canManageSettings ? <SettingsForm company={company} /> : null}

      {canManageSettings ? <RoiSettingsForm company={company} /> : null}

      <AnalyticsCard
        title="Papéis e permissões"
        description="O que cada papel pode fazer no NFC OS — referência rápida para quem convida a equipe."
        className="max-w-2xl"
      >
        <PermissionMatrix
          roles={ALL_ROLES}
          roleLabels={ROLE_LABEL}
          permissions={ALL_PERMISSIONS}
          permissionLabels={PERMISSION_LABEL}
          hasPermission={roleHasPermission}
        />
      </AnalyticsCard>

      {canManageOrganization ? (
        <OrganizationCard organization={organization} currentCompanyId={ctx.companyId} canManage={canManageOrganization} />
      ) : null}

      {canReadAudit ? <AuditLogCard logs={auditLogs} /> : null}
    </div>
  );
}
