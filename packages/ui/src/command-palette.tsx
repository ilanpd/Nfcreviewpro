"use client";

import { useEffect, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search, type LucideIcon } from "lucide-react";
import { cn } from "cn";

/**
 * Command Palette do NFC OS — Cmd+K/Ctrl+K abre em qualquer tela do
 * dashboard. Usa `cmdk` (a mesma biblioteca por trás do Command do
 * shadcn/ui e de paletas como a do Linear/Vercel) em vez de reimplementar
 * navegação por teclado e busca fuzzy à mão — "menos cliques sempre vence"
 * (ver MANIFESTO_DO_DESIGN.md) só vale a pena se a busca for rápida e o
 * teclado funcionar direito.
 */

export interface CommandPaletteItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
}

export interface CommandPaletteGroup {
  heading: string;
  items: CommandPaletteItem[];
}

interface CommandPaletteProps {
  groups: CommandPaletteGroup[];
  placeholder?: string;
}

/** Controla a abertura via Cmd+K / Ctrl+K a partir de qualquer lugar do
 * dashboard — chamar uma vez no layout, não por página. */
export function useCommandPaletteShortcut() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}

export function CommandPalette({ open, onOpenChange, groups, placeholder = "Buscar ou executar um comando…" }: CommandPaletteProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <CommandPrimitive.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command Palette"
      className="fixed top-1/4 left-1/2 z-[120] w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-premium"
      shouldFilter
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <CommandPrimitive.Input
          placeholder={placeholder}
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
          Esc
        </kbd>
      </div>
      <CommandPrimitive.List className="max-h-80 overflow-y-auto p-2">
        <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
          Nada encontrado.
        </CommandPrimitive.Empty>
        {groups.map((group) => (
          <CommandPrimitive.Group
            key={group.heading}
            heading={group.heading}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {group.items.map((item) => (
              <CommandPrimitive.Item
                key={item.id}
                value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
                onSelect={() => {
                  item.onSelect();
                  onOpenChange(false);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm",
                  "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                )}
              >
                {item.icon ? <item.icon className="size-4 shrink-0 text-muted-foreground" /> : null}
                <span className="flex-1">{item.label}</span>
                {item.shortcut ? <kbd className="text-[10px] text-muted-foreground">{item.shortcut}</kbd> : null}
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.Group>
        ))}
      </CommandPrimitive.List>
    </CommandPrimitive.Dialog>
  );
}
