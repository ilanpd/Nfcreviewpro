"use client";

import { useState } from "react";
import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { Menu, Nfc } from "lucide-react";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { Button } from "@/components/ui/button";
import { GlassNavbar, PremiumDrawer } from "@nfc-os/ui";
import { ThemeToggle } from "@/components/theme-toggle";

// Âncoras (`#...`) sempre resolvem contra a home (`/#como-funciona`), nunca
// soltas (`#como-funciona`) — uma âncora solta só funciona se o visitante já
// estiver na home; em qualquer outra página (`/loja`, `/developers`) ela não
// navega a lugar nenhum, porque o elemento com aquele id não existe ali.
// Achado real: clicar em "Como funciona" a partir de `/loja` não fazia nada
// — parecia a mesma navegação travada do bug do `/developers`.
const NAV_LINKS = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#planos", label: "Planos" },
  { href: "/loja", label: "Loja" },
  { href: "/#faq", label: "FAQ" },
  { href: "/developers", label: "Desenvolvedores" },
] as const;

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <GlassNavbar>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
          <BrandWordmark className="text-lg" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/sign-in">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/comecar">Começar grátis</Link>
          </Button>
        </div>

        {/* Mobile (< sm): o header em uma linha só não cabe logo + 4 links +
            2 botões — em vez de forçar tudo e quebrar em várias linhas
            (achado real testando em 375px), o menu completo vive num
            PremiumDrawer, sempre alcançável, nunca escondido sem saída. */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      <PremiumDrawer open={mobileOpen} onOpenChange={setMobileOpen} icon={Nfc} title={BRAND.name} glass={false}>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 font-medium text-foreground hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">
          <Button asChild variant="outline" className="w-full">
            <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
              Entrar
            </Link>
          </Button>
          <Button asChild className="w-full">
            <Link href="/comecar" onClick={() => setMobileOpen(false)}>
              Começar grátis
            </Link>
          </Button>
        </div>
      </PremiumDrawer>
    </GlassNavbar>
  );
}
