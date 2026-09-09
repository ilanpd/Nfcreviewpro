"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "cn";
import { staggerContainer, slideUp } from "@nfc-os/animations";

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  status: "done" | "current" | "upcoming";
  /** Elemento já renderizado, não a referência do componente — ver a nota
   * em premium-card.tsx. */
  icon?: React.ReactNode;
}

/**
 * Timeline — marcos ordenados (fases do roadmap, etapas de um processo),
 * não um log de eventos (isso é o Activity Feed, ao lado). A linha vertical
 * e o estado de cada nó comunicam progresso de um relance.
 */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <motion.ol initial="hidden" animate="visible" variants={staggerContainer} className={cn("relative space-y-6", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <motion.li key={item.id} variants={slideUp} className="relative flex gap-4">
            {!isLast ? (
              <span
                className={cn(
                  "absolute top-7 left-3.5 h-[calc(100%+0.5rem)] w-px",
                  item.status === "upcoming" ? "bg-border" : "bg-brand/40"
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold [&_svg]:size-3.5",
                item.status === "done" && "border-brand bg-brand text-brand-foreground",
                item.status === "current" && "border-brand bg-background text-brand animate-pulse",
                item.status === "upcoming" && "border-border bg-background text-muted-foreground"
              )}
            >
              {item.status === "done" ? <Check className="size-3.5" /> : item.icon ?? null}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className={cn("text-sm font-medium", item.status === "upcoming" ? "text-muted-foreground" : "text-foreground")}>
                {item.title}
              </p>
              {item.description ? <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p> : null}
            </div>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
