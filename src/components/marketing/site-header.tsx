"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Nfc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassNavbar, PremiumDrawer } from "@nfc-os/ui";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
  { href: "/developers", label: "Desenvolvedores" },
] as const;

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <GlassNavbar>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
          <Nfc className="size-5" />
          NFC Review Pro
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) =>
            link.href.startsWith("#") ? (
              <a key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            )
          )}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          <Link href="/sign-in">
            <Button variant="ghost">Entrar</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Começar grátis</Button>
          </Link>
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

      <PremiumDrawer open={mobileOpen} onOpenChange={setMobileOpen} icon={Nfc} title="NFC Review Pro" glass={false}>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV_LINKS.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 font-medium text-foreground hover:bg-muted"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 font-medium text-foreground hover:bg-muted"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>
        <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">
          <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
            <Button variant="outline" className="w-full">
              Entrar
            </Button>
          </Link>
          <Link href="/sign-up" onClick={() => setMobileOpen(false)}>
            <Button className="w-full">Começar grátis</Button>
          </Link>
        </div>
      </PremiumDrawer>
    </GlassNavbar>
  );
}
