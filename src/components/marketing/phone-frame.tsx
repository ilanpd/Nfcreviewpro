import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Moldura de celular reutilizável (extraída de `hero-mockup.tsx` no C15) —
 * usada tanto na cena do Hero quanto na miniatura do tile "Cartão NFC + QR
 * Code" do Bento (`bento-features.tsx`), pra nunca duplicar a mesma moldura
 * (borda, notch, fundo) em dois lugares. Só o chrome; o conteúdo da tela é
 * sempre passado como `children`.
 */
export function PhoneFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0A0A0C] shadow-premium",
        className
      )}
    >
      <div aria-hidden className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/15" />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3 pt-6">{children}</div>
    </div>
  );
}
