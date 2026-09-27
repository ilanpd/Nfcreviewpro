import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getAuthContext } from "@/lib/auth";
import { billingGateEnforced } from "@/lib/billing-gate";
import { accessNotice, dashboardGateTarget } from "@/domain/billing/gate";
import { AccessBanner } from "@/components/dashboard/access-banner";
import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";
import { getCompanyById } from "@/services/company.service";
import { getInProgressOrderForCompany } from "@/services/store-order.service";
import { companyToBrandConfig } from "@/domain/white-label/types";
import { BrandProvider } from "@/components/white-label/brand-provider";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { OrderStatusBanner } from "@/components/dashboard/order-status-banner";
import { DashboardCommandPalette } from "@/components/dashboard/dashboard-command-palette";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SmartBadge } from "@nfc-os/ui";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/onboarding");

  // Painel só com assinatura (ADR-079). Só age com BILLING_GATE_ENFORCE=1.
  const gateTarget = dashboardGateTarget(ctx.access, billingGateEnforced());
  if (gateTarget) redirect(gateTarget);
  const notice = accessNotice(ctx.access);

  const [company, inProgressOrder] = await Promise.all([
    getCompanyById(ctx.companyId),
    getInProgressOrderForCompany(ctx.companyId),
  ]);

  return (
    <BrandProvider brand={companyToBrandConfig(company)}>
      <SidebarProvider className="h-dvh overflow-hidden">
        <AppSidebar companyName={company.name} logoUrl={company.logoUrl} plan={company.plan} />
        {/* `h-dvh overflow-hidden` aqui (em vez de deixar crescer com o
            conteúdo, o padrão de `SidebarInset`) é o que dá um teto FIXO e
            real pro shell inteiro — sem isso, qualquer página cujo conteúdo
            passe da viewport (um banner de pedido, um header mais alto, uma
            página nova) empurra a ALTURA DO DOCUMENTO inteiro pra baixo, e o
            navegador passa a rolar a página toda em vez do `<main>` rolar
            sozinho. O `<main>` abaixo é que vira a única área com scroll
            (`overflow-y-auto`) — normal pra a maioria das páginas, mas dá pro
            Mapa de Mesas (que não quer rolagem nenhuma, só o pan/zoom do
            próprio canvas) um teto de verdade pra ocupar com `flex-1`, sem
            nenhuma conta de pixels/rem cravada no código — see table-map-view.tsx. */}
        <SidebarInset className="overflow-hidden">
          <header className="glass sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <SmartBadge label={`Plano ${company.plan}`} tone="neutral" />
            <div className="ml-auto flex items-center gap-3">
              <ThemeToggle />
              <DashboardCommandPalette />
              {isDevRuntimeEnabled() ? (
                // Dev Runtime (Fase 12) não tem uma sessão Clerk real por trás
                // — <UserButton/> exige <ClerkProvider/>, removido de propósito
                // nesse modo (ADR-052). Nunca fingir um menu de usuário que não
                // funciona; só identificar quem está "logado" nesta sessão.
                <span
                  className="flex size-7 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-ink"
                  title={`Dev Runtime — ${ctx.email}`}
                >
                  {ctx.email.slice(0, 1).toUpperCase()}
                </span>
              ) : (
                <UserButton />
              )}
            </div>
          </header>
          <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
            {notice ? <AccessBanner notice={notice} /> : null}
            {inProgressOrder ? <OrderStatusBanner order={inProgressOrder} /> : null}
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </BrandProvider>
  );
}
