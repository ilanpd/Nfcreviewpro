"use client";

import { motion } from "framer-motion";
import { fadeIn } from "@nfc-os/animations";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /** Elemento já renderizado (`<Icon className="size-5" />`), não a
   * referência do componente — ver a nota em premium-card.tsx sobre por
   * que isso importa quando o chamador é uma Server Component. */
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

/** Um estado vazio nunca é "sem dados" — é sempre uma oportunidade de
 * mostrar o próximo passo. Ver MANIFESTO_DO_DESIGN.md. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 px-6 py-12 text-center ${className ?? ""}`}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-subtle text-brand [&_svg]:size-5">{icon}</span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? (
        <Button size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      ) : null}
    </motion.div>
  );
}
