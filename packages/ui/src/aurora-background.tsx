"use client";

import { cn } from "cn";
import { usePrefersReducedMotion } from "@nfc-os/animations";

/**
 * Camada proprietária do NFC OS Design Language (Fase 14). Não existe um
 * "Aurora Background" de página inteira em nenhum registry conectado
 * (`@shadcn`/`@magicui`) — só um efeito de texto (`aurora-text`). O visual
 * de referência (blobs de gradiente animados) é simples o bastante para
 * construir sobre os tokens de marca já existentes, em vez de importar uma
 * versão genérica roxa fixa (que não reagiria ao White Label) ou uma URL de
 * registry de terceiro não verificada. Ver ADR-059/CATALOGO_VISUAL_OFICIAL.
 *
 * Cobre também o papel de "Mesh Gradient" pedido separadamente — é a mesma
 * técnica (blobs de gradiente radial desfocados); duas variantes visuais do
 * mesmo componente, não dois componentes.
 */
export function AuroraBackground({
  className,
  variant = "subtle",
}: {
  className?: string;
  /** "subtle" para telas de trabalho (se algum dia usado fora de marketing),
   * "vivid" para a Landing — mais saturação, mais movimento. */
  variant?: "subtle" | "vivid";
}) {
  const reducedMotion = usePrefersReducedMotion();
  const vivid = variant === "vivid";

  return (
    <div className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)} aria-hidden>
      <div
        className={cn(
          "absolute -top-1/4 left-1/2 aspect-square w-[70%] -translate-x-1/2 rounded-full blur-3xl",
          !reducedMotion && "animate-aurora-drift-a"
        )}
        style={{
          opacity: vivid ? 0.55 : 0.3,
          background:
            "radial-gradient(circle, var(--brand) 0%, color-mix(in oklch, var(--brand) 40%, transparent) 45%, transparent 70%)",
        }}
      />
      <div
        className={cn(
          "absolute top-1/3 -right-1/4 aspect-square w-[55%] rounded-full blur-3xl",
          !reducedMotion && "animate-aurora-drift-b"
        )}
        style={{
          opacity: vivid ? 0.45 : 0.22,
          background:
            "radial-gradient(circle, var(--chart-2) 0%, color-mix(in oklch, var(--chart-2) 35%, transparent) 45%, transparent 70%)",
        }}
      />
      <div
        className={cn(
          "absolute -bottom-1/4 left-[10%] aspect-square w-[50%] rounded-full blur-3xl",
          !reducedMotion && "animate-aurora-drift-c"
        )}
        style={{
          opacity: vivid ? 0.4 : 0.18,
          background:
            "radial-gradient(circle, var(--chart-3) 0%, color-mix(in oklch, var(--chart-3) 30%, transparent) 45%, transparent 70%)",
        }}
      />
    </div>
  );
}
