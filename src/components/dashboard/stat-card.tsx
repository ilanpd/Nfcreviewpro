import type { LucideIcon } from "lucide-react";
import { KpiCard } from "@nfc-os/ui";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  accent?: "default" | "positive";
}

/** Wrapper fino sobre o Card KPI do NFC OS Design Language — mantém a
 * mesma API que as telas já usam (`icon` como referência de componente,
 * conveniente para quem chama de uma Server Component), só troca o visual
 * por baixo. A conversão para elemento renderizado acontece aqui, no ponto
 * exato em que cruza para dentro do KpiCard ("use client") — ver a nota em
 * packages/ui/src/premium-card.tsx. */
export function StatCard({ label, value, icon: Icon, hint, accent = "default" }: StatCardProps) {
  return (
    <KpiCard
      label={label}
      value={value}
      icon={<Icon />}
      hint={hint}
      valueClassName={accent === "positive" ? "text-emerald-600 dark:text-emerald-400" : undefined}
    />
  );
}
