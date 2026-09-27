import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Nome da marca com o glifo oficial (C12, ADR-087) — antes era só texto +
 * um ponto âmbar como "provisório" (nunca existiu um arquivo de logo real
 * até agora). O glifo é metálico/cinza-claro: ilegível direto sobre um
 * fundo claro, por isso vive dentro de um chip escuro fixo — a mesma
 * legibilidade nos dois temas, em vez de duas versões do componente.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading font-semibold tracking-tight", className)}>
      <span className="flex aspect-square h-[1.6em] shrink-0 items-center justify-center rounded-md bg-[#0A0A0C] p-[0.22em]">
        <Image src="/brand/logo-mark.png" alt="" width={64} height={71} className="size-full object-contain" priority />
      </span>
      {BRAND.name}
    </span>
  );
}
