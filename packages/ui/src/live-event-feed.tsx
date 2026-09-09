"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Radio, Star, MessageSquareWarning, RefreshCw } from "lucide-react";
import { slideInFromRight } from "@nfc-os/animations";
import { EmptyState } from "./empty-state";

export interface LiveFeedEntry {
  id: string;
  kind: "REDIRECT" | "RATING" | "FEEDBACK" | "ASSIGNMENT_CHANGED";
  message: string;
  /** Já formatado para exibição (ex.: "14:32:07") — este componente não
   * formata datas, só renderiza o que recebe. */
  timestamp: string;
}

const KIND_ICON: Record<LiveFeedEntry["kind"], React.ReactNode> = {
  REDIRECT: <Radio className="size-3.5" />,
  RATING: <Star className="size-3.5" />,
  FEEDBACK: <MessageSquareWarning className="size-3.5" />,
  ASSIGNMENT_CHANGED: <RefreshCw className="size-3.5" />,
};

const MAX_VISIBLE = 30;

/**
 * Feed de eventos ao vivo (Fase 6) — diferente do `ActivityFeed` (histórico
 * de auditoria, cresce por baixo, sem urgência): aqui a novidade é o próprio
 * produto, então cada linha nasce deslizando a partir do topo para ficar
 * óbvio no instante em que chega. Usado pelo Live Mode e pelo Command
 * Center, sempre alimentado pelos mesmos `LiveEvent` do domínio (ver
 * domain/live/types.ts) — nunca uma cópia própria do formato do evento.
 */
export function LiveEventFeed({ entries }: { entries: LiveFeedEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState icon={<Radio className="size-5" />} title="Nenhum evento ainda — o salão está quieto." />;
  }

  return (
    <ul className="space-y-1">
      <AnimatePresence initial={false}>
        {entries.slice(0, MAX_VISIBLE).map((entry) => (
          <motion.li
            key={entry.id}
            layout
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={slideInFromRight}
            className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-accent/50"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
              {KIND_ICON[entry.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{entry.message}</p>
              <p className="text-xs text-muted-foreground">{entry.timestamp}</p>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
