import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Nome da marca como texto, com o ponto âmbar (o "brilho do batimento" da
 * marca Pulse). Provisório de verdade: quando o logo final em SVG existir
 * (ação humana, ver PROXIMAS_TAREFAS.md), este componente passa a renderizá-lo
 * e todas as telas que o usam trocam de uma vez.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline font-heading font-semibold tracking-tight", className)}>
      {BRAND.name}
      <span aria-hidden className="ml-[0.12em] inline-block size-[0.3em] rounded-full bg-brand" />
    </span>
  );
}
