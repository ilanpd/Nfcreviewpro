"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, Gift, LayoutDashboard, LayoutGrid, Megaphone, Settings, Users, Code2, Palette, Sparkles, MapPin, Lock, LifeBuoy } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { planHasFeature, type PlanFeature } from "@/lib/plans";
import type { PlanType } from "@/generated/prisma/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/cards", label: "Cartões", icon: CreditCard },
  { href: "/dashboard/retorno", label: "Retorno", icon: Gift },
  { href: "/dashboard/table-map", label: "Mapa de Mesas", icon: LayoutGrid, feature: "table_map" },
  { href: "/dashboard/unidades", label: "Unidades e zonas", icon: MapPin, feature: "multi_branch" },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: Megaphone, feature: "campaigns" },
  { href: "/dashboard/playbooks", label: "Playbooks", icon: Sparkles, feature: "automation" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/team", label: "Equipe", icon: Users },
  { href: "/dashboard/developers", label: "Desenvolvedores", icon: Code2, feature: "api_access" },
  { href: "/dashboard/branding", label: "Branding", icon: Palette, feature: "white_label" },
  { href: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
] satisfies { href: string; label: string; icon: typeof LayoutDashboard; feature?: PlanFeature }[];

interface AppSidebarProps {
  companyName: string;
  logoUrl: string | null;
  plan: PlanType;
}

/**
 * Fase 20 — cada item com `feature` ganha um cadeado quando o plano atual
 * não inclui — nunca escondido: visibilidade aspiracional (mostrar o que
 * falta) converte mais do que simplesmente sumir com a opção. O clique
 * continua funcionando normalmente — a página de destino é quem decide
 * mostrar o upsell completo (`PlanUpsell`), aqui é só o sinal visual.
 */
export function AppSidebar({ companyName, logoUrl, plan }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={companyName} className="size-7 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              {companyName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            {companyName}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
                const isLocked = item.feature ? !planHasFeature(plan, item.feature) : false;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={isLocked ? `${item.label} — recurso de plano superior` : item.label}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                        {isLocked ? <Lock className="ml-auto size-3 shrink-0 text-muted-foreground" /> : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
