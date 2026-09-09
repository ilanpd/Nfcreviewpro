import { cn } from "cn";

type Tone = "success" | "warning" | "danger" | "info" | "brand" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  danger: "bg-red-500/12 text-red-700 dark:text-red-400",
  info: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  brand: "bg-brand-subtle text-brand",
  neutral: "bg-muted text-muted-foreground",
};

interface SmartBadgeProps {
  label: string;
  tone?: Tone;
  /** Cor exata (hex) para status de domínio (ex.: cor por tipo de campanha)
   * — sobrepõe `tone` quando presente. */
  color?: string;
  /** Elemento já renderizado (`<Icon className="size-3" />`), não a
   * referência do componente — ver a nota em premium-card.tsx. */
  icon?: React.ReactNode;
  /** Um ponto pulsante — para status "ao vivo"/ativo agora, não para
   * qualquer badge (ver MANIFESTO_DO_DESIGN.md: animação comunica estado). */
  pulse?: boolean;
  className?: string;
}

/**
 * Badge Inteligente — uma única API para todo indicador de status do
 * produto (campanha, membro, mesa, conflito), em vez de cada tela escolher
 * cor/variant manualmente. "Inteligente" no sentido de: dado um `tone`
 * semântico, a cor certa já vem de brinde.
 */
export function SmartBadge({ label, tone = "neutral", color, icon, pulse, className }: SmartBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        !color && TONE_CLASSES[tone],
        className
      )}
      style={color ? { backgroundColor: `${color}1F`, color } : undefined}
    >
      {pulse ? (
        <span className="relative flex size-1.5">
          <span
            className="absolute inline-flex size-full animate-ping rounded-full opacity-75"
            style={{ backgroundColor: color ?? "currentColor" }}
          />
          <span className="relative inline-flex size-1.5 rounded-full" style={{ backgroundColor: color ?? "currentColor" }} />
        </span>
      ) : icon ? (
        <span className="[&_svg]:size-3">{icon}</span>
      ) : null}
      {label}
    </span>
  );
}
