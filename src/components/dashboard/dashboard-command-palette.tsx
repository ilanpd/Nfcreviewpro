"use client";

import { useRouter } from "next/navigation";
import { BarChart3, CreditCard, LayoutDashboard, LayoutGrid, Megaphone, Search, Settings, Users } from "lucide-react";
import { CommandPalette, useCommandPaletteShortcut } from "@nfc-os/ui";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/cards", label: "Cartões", icon: CreditCard },
  { href: "/dashboard/table-map", label: "Mapa de Mesas", icon: LayoutGrid },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: Megaphone },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/team", label: "Equipe", icon: Users },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
] as const;

/** Cmd+K/Ctrl+K em qualquer tela do dashboard — navegação rápida por
 * enquanto não existem ações mais ricas (criar campanha, convidar membro)
 * para adicionar aqui em fases futuras sem mudar a API do componente. */
export function DashboardCommandPalette() {
  const router = useRouter();
  const { open, setOpen } = useCommandPaletteShortcut();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden rounded border border-border/60 px-1 text-[10px] sm:inline">⌘K</kbd>
      </button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        groups={[
          {
            heading: "Navegar",
            items: NAV_ITEMS.map((item) => ({
              id: item.href,
              label: item.label,
              icon: item.icon,
              onSelect: () => router.push(item.href),
            })),
          },
        ]}
      />
    </>
  );
}
