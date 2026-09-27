"use client";

import { usePrefersReducedMotion } from "@nfc-os/animations";
import { PremiumCardShell } from "@nfc-os/ui";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  default: "text-foreground",
  danger: "text-red-400",
  warning: "text-amber-400",
  success: "text-emerald-400",
} as const;

/**
 * Modo Executivo (Fase 19.8) — o mesmo `KpiCard` do resto do Admin foi
 * desenhado pra ser lido de perto, numa tela de trabalho; um wallboard
 * precisa de números grandes o bastante pra ler a 3+ metros. Em vez de
 * forçar o `KpiCard` (tipado pra `value: string | number`, sem espaço pra
 * um `NumberTicker` animado) a servir aos dois casos, este é um tile novo
 * — mas ainda a mesma `PremiumCardShell` da base de todo card do produto,
 * nunca uma superfície própria. `prefers-reduced-motion`: `startValue` vira
 * o próprio valor final, então a mola nunca tem o que animar.
 */
export function WallboardMetric({
  label,
  value,
  prefix,
  suffix,
  icon,
  tone = "default",
}: {
  label: string;
  value: number | null;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  tone?: keyof typeof TONE_CLASS;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <PremiumCardShell className="p-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("mt-3 flex items-baseline gap-0.5 font-mono text-4xl font-bold tabular-nums xl:text-5xl", TONE_CLASS[tone])}>
        {value === null ? (
          "—"
        ) : (
          <>
            {prefix}
            <NumberTicker value={value} startValue={reducedMotion ? value : 0} />
            {suffix}
          </>
        )}
      </p>
    </PremiumCardShell>
  );
}
