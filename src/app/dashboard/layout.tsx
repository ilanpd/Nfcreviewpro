import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getAuthContext } from "@/lib/auth";
import { getCompanyById } from "@/services/company.service";
import { companyToBrandConfig } from "@/domain/white-label/types";
import { BrandProvider } from "@/components/white-label/brand-provider";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardCommandPalette } from "@/components/dashboard/dashboard-command-palette";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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
            <Badge variant="secondary" className="font-normal">
              Plano {company.plan}
            </Badge>
            <div className="ml-auto flex items-center gap-3">
              <DashboardCommandPalette />
              <UserButton />
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </BrandProvider>
  );
}
