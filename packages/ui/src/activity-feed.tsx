"use client";

import { motion } from "framer-motion";
import { History } from "lucide-react";
import { staggerContainer, slideUp } from "@nfc-os/animations";
import { EmptyState } from "./empty-state";

export interface ActivityFeedEntry {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  /** Elemento já renderizado, não a referência do componente — ver a nota
   * em premium-card.tsx. */
  icon?: React.ReactNode;
}

/** Activity Feed — um log de "quem fez o quê, quando", cronológico e
 * denso; reaproveitado pelo AuditLogCard de Configurações e por
 * `/dev/ceo`. Diferente da Timeline: não representa progresso ordenado,
 * representa um histórico que só cresce. */
export function ActivityFeed({ entries, emptyLabel = "Nenhuma atividade registrada ainda." }: { entries: ActivityFeedEntry[]; emptyLabel?: string }) {
  if (entries.length === 0) {
    return <EmptyState icon={<History className="size-5" />} title={emptyLabel} />;
  }

  return (
    <motion.ul initial="hidden" animate="visible" variants={staggerContainer} className="space-y-1">
      {entries.map((entry) => (
        <motion.li key={entry.id} variants={slideUp} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-accent/50">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-3.5">
            {entry.icon ?? null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">
              <span className="font-medium">{entry.actor}</span> {entry.action}
            </p>
            <p className="text-xs text-muted-foreground">{entry.timestamp}</p>
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}
