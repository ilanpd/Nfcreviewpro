"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Image as ImageIcon, Package, Building2, ShieldCheck, Wallet, Monitor, Mail } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Fase 19.1 — sidebar agrupado por área de operação, não mais uma lista
 * plana de 4 links. Grupos refletem só o que é genuinamente escopo global
 * do dono da plataforma hoje — Campanhas/Playbooks/Branding/Analytics são
 * recursos POR EMPRESA do `/dashboard`, não pertencem aqui (ver plano da
 * Fase 19, seção "o que a auditoria derrubou"). Grupo Financeiro nasceu na
 * Fase 19.6; "Modo Executivo" (Fase 19.8) entra em Operação — ao clicar,
 * sai deste layout com sidebar para o wallboard full-bleed
 * (`admin/executivo`, fora do route group `(sidebar)`).
 */
function buildNavGroups(pendingOrders: number, pendingContactMessages: number): NavGroup[] {
  return [
    {
      label: "Operação",
      items: [
        { href: "/admin", label: "Centro de Operações", icon: LayoutDashboard },
        { href: "/admin/pedidos", label: "Pedidos da loja", icon: Package, badge: pendingOrders },
        { href: "/admin/executivo", label: "Modo Executivo", icon: Monitor },
      ],
    },
    {
      label: "Empresas",
      items: [
        { href: "/admin/empresas", label: "Empresas", icon: Building2 },
        { href: "/admin/conteudo", label: "Conteúdo do site", icon: ImageIcon },
      ],
    },
    {
      label: "Financeiro",
      items: [{ href: "/admin/financeiro", label: "Receita", icon: Wallet }],
    },
    {
      // C9/F6 — o único canal de quem escreve pelo site sem ter conta ainda
      // (ver services/contact.service.ts). Grupo próprio, pequeno demais
      // pra forçar dentro de "Empresas" (nem toda mensagem é de um cliente).
      label: "Suporte",
      items: [{ href: "/admin/contato", label: "Mensagens do site", icon: Mail, badge: pendingContactMessages }],
    },
  ];
}

export function AdminSidebar({
  pendingOrders = 0,
  pendingContactMessages = 0,
  adminEmail,
}: {
  pendingOrders?: number;
  pendingContactMessages?: number;
  adminEmail?: string;
}) {
  const pathname = usePathname();
  const groups = buildNavGroups(pendingOrders, pendingContactMessages);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <ShieldCheck className="size-5 text-brand-ink" />
          <span className="font-semibold tracking-tight">Painel Admin</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {adminEmail ? (
        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-[11px] font-semibold text-brand-ink">
              {adminEmail.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">{adminEmail}</span>
          </div>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}
