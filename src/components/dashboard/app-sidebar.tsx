"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, LayoutDashboard, LayoutGrid, Megaphone, Settings, Users, Code2, Palette, Sparkles } from "lucide-react";
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

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/cards", label: "Cartões", icon: CreditCard },
  { href: "/dashboard/table-map", label: "Mapa de Mesas", icon: LayoutGrid },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: Megaphone },
  { href: "/dashboard/playbooks", label: "Playbooks", icon: Sparkles },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/team", label: "Equipe", icon: Users },
  { href: "/dashboard/developers", label: "Desenvolvedores", icon: Code2 },
  { href: "/dashboard/branding", label: "Branding", icon: Palette },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
] as const;

interface AppSidebarProps {
  companyName: string;
  logoUrl: string | null;
}

export function AppSidebar({ companyName, logoUrl }: AppSidebarProps) {
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
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
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
