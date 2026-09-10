"use client";

import { cn } from "cn";
import { PremiumCardShell } from "./premium-card";
import { MagicCard } from "@/components/ui/magic-card";

/**
 * Camada proprietária do NFC OS Design Language (Fase 14) — variante de
 * `PremiumCardShell` para superfícies de marketing sobre um fundo animado
 * (`AuroraBackground`), onde o card opaco padrão ficaria pesado demais.
 * Nunca reimplementa `PremiumCardShell` — compõe.
 *
 * `spotlight` usa o `MagicCard` (Magic UI, já instalado) com as cores de
 * marca do produto — os `gradientFrom/gradientTo` padrão do componente
 * vêm com roxo/rosa fixos do template original do Magic UI, nunca usados
 * aqui sem sobrescrever com os tokens de marca (ver ADR-059/Manifesto
 * Princípio 8: cor tem significado, nunca decoração importada). `spotlight`
 * e `glass` não se combinam — o `MagicCard` já pinta seu próprio fundo
 * opaco internamente (não é possível deixá-lo translúcido sem reescrever o
 * componente vendorizado), então `spotlight` tem precedência quando os
 * dois são pedidos juntos.
 */
export function GlassPremiumCard({
  children,
  className,
  glass = true,
  spotlight = false,
}: {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
  spotlight?: boolean;
}) {
  if (spotlight) {
    return (
      <MagicCard
        className={cn("rounded-xl border border-border/60 shadow-subtle", className)}
        gradientFrom="var(--brand)"
        gradientTo="var(--chart-2)"
        gradientColor="var(--muted)"
        gradientOpacity={0.35}
      >
        {children}
      </MagicCard>
    );
  }

  return (
    <PremiumCardShell className={cn(glass && "glass border-white/10 shadow-elevated", className)}>
      {children}
    </PremiumCardShell>
  );
}
