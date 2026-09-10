"use client";

import { cn } from "cn";

/**
 * Camada proprietária do NFC OS Design Language (Fase 14) — a superfície de
 * "chrome flutuante" (`.glass`, `globals.css`) formalizada como componente,
 * para qualquer navegação fixa/sticky (Landing hoje; potencialmente uma
 * topbar de dashboard no futuro) reaproveitar em vez de recriar
 * `bg-background/80 backdrop-blur-md` à mão em cada tela.
 */
export function GlassNavbar({
  children,
  className,
  sticky = true,
}: {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <header
      className={cn(
        "glass z-50 border-b border-border/60",
        sticky && "sticky top-0",
        className
      )}
    >
      {children}
    </header>
  );
}
