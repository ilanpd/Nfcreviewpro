"use client";

import { CreditCard } from "lucide-react";
import type { TableCardItem } from "@/types";

interface UnplacedTrayProps {
  cards: TableCardItem[];
  armedId: string | null;
  onToggleArm: (id: string) => void;
}

/** A card created on the Cards page has no canvas position yet — this strip
 * is how it gets one. Click a chip to "arm" it, then click anywhere on the
 * canvas to drop it there (see Canvas's armedCardId/onPlaceArmed). Simpler
 * and less error-prone than computing exact drop coordinates through a
 * cross-component native drag, since there's no existing position to drag
 * *from* on the canvas for an unplaced table. */
export function UnplacedTray({ cards, armedId, onToggleArm }: UnplacedTrayProps) {
  if (cards.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b bg-amber-50 px-3 py-2 dark:bg-amber-950/20">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">Não posicionadas:</span>
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onToggleArm(card.id)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            armedId === card.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
          }`}
        >
          <CreditCard className="size-3" />
          {card.name}
        </button>
      ))}
    </div>
  );
}
