import { requireAuthContext, requirePermission } from "@/lib/auth";
import { getCompanyById } from "@/services/company.service";
import { listCards } from "@/services/card.service";
import { getRootDomain } from "@/domain/white-label/host";
import { planHasFeature, minimumPlanForFeature } from "@/lib/plans";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { ThemeStudioView } from "@/components/dashboard/branding/theme-studio-view";
import { EmptyState } from "@nfc-os/ui";
import { Lock, Palette } from "lucide-react";

/**
 * Theme Studio (Fase 10) — identidade completa da empresa num único lugar:
 * logo, favicon, cores, tela de login, domínio personalizado, e preview ao
 * vivo (dashboard/login/QR/ativos de impressão). Restrito a
 * `settings:write` — a mesma permissão que já protegia editar logo/cor em
 * Configurações, não uma nova (branding não é mais sensível que o resto
 * das configurações da empresa, ao contrário de chaves de API — ver
 * ADR-040 para a distinção).
 */
export default async function BrandingPage() {
  const ctx = await requireAuthContext();

  try {
    requirePermission(ctx, "settings:write");
  } catch {
    return (
      <main className="p-6 sm:p-10">
        <EmptyState icon={<Lock />} title="Acesso restrito" description="Só quem pode editar configurações da empresa acessa o Theme Studio." />
      </main>
    );
  }

  if (!planHasFeature(ctx.plan, "white_label")) {
    return (
      <main className="space-y-6 p-6 sm:p-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marca própria</h1>
          <p className="text-sm text-muted-foreground">Logo, cores, domínio e tela de login com a identidade do seu negócio.</p>
        </div>
        <PlanUpsell
          icon={<Palette />}
          featureLabel="Marca própria (domínio e login personalizados)"
          requiredPlan={minimumPlanForFeature("white_label")}
          currentPlan={ctx.plan}
        />
      </main>
    );
  }

  const [company, cards] = await Promise.all([getCompanyById(ctx.companyId), listCards(ctx.companyId)]);

  return (
    <ThemeStudioView
      company={company}
      cards={cards.map((c) => ({ id: c.id, name: c.name }))}
      rootDomain={getRootDomain()}
    />
  );
}
