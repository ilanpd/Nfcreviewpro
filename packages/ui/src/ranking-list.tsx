"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { staggerContainer, slideUp } from "@nfc-os/animations";
import { EmptyState } from "./empty-state";
import { cn } from "cn";

export interface RankingListEntry {
  id: string;
  label: string;
  value: number;
  secondaryLabel?: string;
  color?: string;
}

const MEDAL_COLOR = ["#F59E0B", "#94A3B8", "#B45309"]; // ouro, prata, bronze — só as 3 primeiras posições

/**
 * Ranking Engine (Fase 7) — leaderboard genérico reaproveitado por
 * campanha/zona/mesa/funcionário/horário/dia no Analytics Enterprise e no
 * Command Center. A barra de progresso de cada linha é relativa ao líder
 * (não a um total absoluto), então a diferença entre o 1º e o 2º lugar é
 * sempre visualmente óbvia, seja qual for a escala real dos números.
 */
export function RankingList({ entries, emptyLabel = "Sem dados suficientes neste período." }: { entries: RankingListEntry[]; emptyLabel?: string }) {
  if (entries.length === 0) {
    return <EmptyState icon={<Trophy className="size-5" />} title={emptyLabel} />;
  }

  const max = Math.max(1, ...entries.map((e) => e.value));

  return (
    <motion.ol initial="hidden" animate="visible" variants={staggerContainer} className="space-y-2">
      {entries.map((entry, i) => (
        <motion.li key={entry.id} variants={slideUp} className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              i < 3 ? "text-white" : "bg-muted text-muted-foreground"
            )}
            style={i < 3 ? { backgroundColor: MEDAL_COLOR[i] } : undefined}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground">{entry.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {entry.value.toLocaleString("pt-BR")} {entry.secondaryLabel ?? ""}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: entry.color ?? "var(--brand)" }}
                initial={{ width: 0 }}
                animate={{ width: `${(entry.value / max) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}
