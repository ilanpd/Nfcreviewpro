import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getAuthContext } from "@/lib/auth";
import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";
import { getCompanyById } from "@/services/company.service";
import { companyToBrandConfig } from "@/domain/white-label/types";
import { BrandProvider } from "@/components/white-label/brand-provider";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardCommandPalette } from "@/components/dashboard/dashboard-command-palette";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SmartBadge } from "@nfc-os/ui";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/onboarding");

  const company = await getCompanyById(ctx.companyId);

  return (
    <BrandProvider brand={companyToBrandConfig(company)}>
      <SidebarProvider>
        <AppSidebar companyName={company.name} logoUrl={company.logoUrl} />
        <SidebarInset>
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
                  className="flex size-7 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand"
                  title={`Dev Runtime — ${ctx.email}`}
                >
                  {ctx.email.slice(0, 1).toUpperCase()}
                </span>
              ) : (
                <UserButton />
              )}
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </BrandProvider>
  );
}
