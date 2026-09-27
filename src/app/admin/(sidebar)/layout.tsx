import Link from "next/link";
import { Monitor } from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminCommandPalette } from "@/components/admin/admin-command-palette";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { isDevRuntimeEnabled, devRuntimeUserEmail } from "@/lib/dev-runtime/config";
import { prisma } from "@/lib/prisma";

/**
 * Fase 19.8 — o chrome de sidebar/header do Painel Admin, extraído de
 * `admin/layout.tsx` (que agora só cuida do gate `isSuperAdmin()`, ver seu
 * comentário) para um route group (`(sidebar)`, transparente na URL — todo
 * mundo aqui dentro continua em `/admin`, `/admin/pedidos` etc.). Isso
 * existe para que `admin/executivo` (Modo Executivo, fora deste grupo)
 * possa ser full-bleed sem sidebar nenhuma, sem duplicar o gate de
 * segurança em dois layouts.
 */
export default async function AdminSidebarLayout({ children }: { children: React.ReactNode }) {
  const [pendingOrders, pendingContactMessages, user] = await Promise.all([
    prisma.storeOrder.count({ where: { status: { in: ["PAID", "SHIPPED"] } } }),
    prisma.contactMessage.count({ where: { respondedAt: null } }),
    currentUser().catch(() => null),
  ]);
  const adminEmail = isDevRuntimeEnabled() ? devRuntimeUserEmail() : user?.primaryEmailAddress?.emailAddress;

  return (
    <SidebarProvider>
      <AdminSidebar pendingOrders={pendingOrders} pendingContactMessages={pendingContactMessages} adminEmail={adminEmail} />
      <SidebarInset>
        <header className="glass sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <AdminCommandPalette />
          <div className="ml-auto flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" title="Modo Executivo (wallboard)">
              <Link href="/admin/executivo">
                <Monitor className="size-4" />
              </Link>
            </Button>
            <ThemeToggle />
            {isDevRuntimeEnabled() ? (
              // Dev Runtime (Fase 12) não tem sessão Clerk real por trás —
              // <UserButton/> exige <ClerkProvider/>, removido de propósito
              // nesse modo (ADR-052). Mesmo padrão de dashboard/layout.tsx.
              <span
                className="flex size-7 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-ink"
                title={`Dev Runtime — ${devRuntimeUserEmail()}`}
              >
                {devRuntimeUserEmail().slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <UserButton />
            )}
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
