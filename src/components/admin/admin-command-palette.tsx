"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, LayoutDashboard, Image as ImageIcon, Package, Search, ShoppingCart } from "lucide-react";
import { CommandPalette, useCommandPaletteShortcut, type CommandPaletteGroup } from "@nfc-os/ui";

const NAV_ITEMS = [
  { href: "/admin", label: "Centro de Operações", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos da loja", icon: Package },
  { href: "/admin/empresas", label: "Empresas", icon: Building2 },
  { href: "/admin/conteudo", label: "Conteúdo do site", icon: ImageIcon },
] as const;

interface SearchResult {
  id: string;
  label: string;
  subtitle: string;
  href: string;
}

/**
 * Fase 19.1 — Command+K global do Admin. Estende `CommandPalette` (mesmo
 * componente do dashboard, `DashboardCommandPalette`) no novo modo
 * controlado: acima de 2 caracteres, o cmdk para de filtrar sozinho
 * (`shouldFilter=false`) e os grupos passam a vir de `/api/admin/search`,
 * debounced — nunca refiltra localmente o que o servidor já filtrou.
 */
export function AdminCommandPalette() {
  const router = useRouter();
  const { open, setOpen } = useCommandPaletteShortcut();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ companies: SearchResult[]; orders: SearchResult[]; cards: SearchResult[] }>({
    companies: [],
    orders: [],
    cards: [],
  });

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ companies: [], orders: [], cards: [] });
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then(setResults)
        .catch(() => setResults({ companies: [], orders: [], cards: [] }))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const isSearching = query.trim().length >= 2;

  const groups: CommandPaletteGroup[] = isSearching
    ? [
        {
          heading: "Empresas",
          items: results.companies.map((r) => ({ id: r.id, label: r.label, icon: Building2, keywords: [r.subtitle], onSelect: () => router.push(r.href) })),
        },
        {
          heading: "Pedidos",
          items: results.orders.map((r) => ({ id: r.id, label: r.label, icon: ShoppingCart, keywords: [r.subtitle], onSelect: () => router.push(r.href) })),
        },
        {
          heading: "Cartões NFC",
          items: results.cards.map((r) => ({ id: r.id, label: r.label, icon: CreditCard, keywords: [r.subtitle], onSelect: () => router.push(r.href) })),
        },
      ].filter((g) => g.items.length > 0)
    : [
        {
          heading: "Navegar",
          items: NAV_ITEMS.map((item) => ({ id: item.href, label: item.label, icon: item.icon, onSelect: () => router.push(item.href) })),
        },
      ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Buscar empresa, pedido, cartão…</span>
        <kbd className="hidden rounded border border-border/60 px-1 text-[10px] sm:inline">⌘K</kbd>
      </button>
      <CommandPalette
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        placeholder="Buscar empresa, pedido, cartão…"
        groups={groups}
        value={query}
        onValueChange={setQuery}
        shouldFilter={!isSearching}
        loading={isSearching && loading}
      />
    </>
  );
}
