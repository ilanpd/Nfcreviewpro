"use client";

import { motion } from "framer-motion";
import { staggerContainer, slideUp } from "@nfc-os/animations";

export interface FunnelStageEntry {
  key: string;
  label: string;
  count: number;
  dropoffFromPrevious: number | null;
  caption?: string;
}

/**
 * Funil Inteligente (Fase 7) — cada etapa é uma barra cuja largura é
 * relativa à primeira etapa (o topo do funil), com uma transição suave de
 * largura ao montar/trocar de período. A perda percentual entre etapas
 * aparece como um rótulo entre as barras, não escondida num tooltip — é o
 * número que mais importa para quem está lendo um funil.
 */
export function FunnelChart({ stages }: { stages: FunnelStageEntry[] }) {
  const top = Math.max(1, stages[0]?.count ?? 1);

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-1">
      {stages.map((stage, i) => (
        <motion.div key={stage.key} variants={slideUp}>
          {i > 0 && stage.dropoffFromPrevious !== null ? (
            <div className="flex items-center gap-2 py-1 pl-2 text-xs text-muted-foreground">
              <span>↓</span>
              <span>{stage.dropoffFromPrevious.toFixed(0)}% da etapa anterior</span>
            </div>
          ) : null}
          <div className="rounded-lg border border-border/60 px-4 py-2.5" title={stage.caption}>
            <div className="flex items-center justify-between text-sm font-medium text-foreground">
              <span>{stage.label}</span>
              <span>{stage.count.toLocaleString("pt-BR")}</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-brand"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, (stage.count / top) * 100)}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
              />
            </div>
          </div>
          {stage.caption ? <p className="mt-1 pl-2 text-[11px] text-muted-foreground">{stage.caption}</p> : null}
        </motion.div>
      ))}
    </motion.div>
  );
}
