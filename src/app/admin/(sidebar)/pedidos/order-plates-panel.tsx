"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Boxes, CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssignOnePlateDialog, type OrderCard } from "./assign-one-plate-dialog";
import { AssignPlatesDialog } from "./assign-plates-dialog";

/**
 * "Placas do pedido": uma linha por cartão, dizendo qual placa física cada um
 * tem (série e lote) ou que falta, com o gesto para atribuir ou trocar ali mesmo.
 * É onde o pedido e o estoque se encontram: atribuir uma placa conferida já dá por
 * feitas a impressão, a gravação do chip e o teste do pedido.
 */
export function OrderPlatesPanel({ orderId, cards, editable, onChanged }: { orderId: string; cards: OrderCard[]; editable: boolean; onChanged: () => void }) {
  const [openCard, setOpenCard] = useState<OrderCard | null>(null);
  const withPlate = cards.filter((c) => c.plate).length;
  const missing = cards.length - withPlate;
  const done = missing === 0;

  return (
    <section aria-labelledby="placas-pedido" className="space-y-2.5 rounded-xl border p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="placas-pedido" className="flex items-center gap-1.5 text-sm font-semibold">
          <Boxes className="size-4" aria-hidden="true" /> Placas do pedido
        </h3>
        <span className={done ? "inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300" : "inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300"}>
          {done ? <CircleCheck className="size-3.5" aria-hidden="true" /> : <CircleAlert className="size-3.5" aria-hidden="true" />}
          {withPlate} de {cards.length} com placa
        </span>
      </div>

      {editable && missing > 1 ? <AssignPlatesDialog orderId={orderId} missing={missing} onDone={onChanged} /> : null}

      <ul className={cn("space-y-1.5", cards.length > 6 && "max-h-80 overflow-y-auto pr-1")} aria-label="Cartões do pedido">
        {cards.map((card) => (
          <li key={card.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{card.name}</p>
              {card.plate ? (
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">{card.plate.serial}</span>
                  {card.plate.batchCode ? ` · lote ${card.plate.batchCode}` : ""}
                  {card.plate.status === "VERIFIED" ? " · conferida" : " · ainda em produção"}
                </p>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">Sem placa atribuída</p>
              )}
            </div>
            {editable ? (
              <Button type="button" size="sm" variant={card.plate ? "outline" : "default"} onClick={() => setOpenCard(card)} aria-label={`${card.plate ? "Trocar a placa de" : "Atribuir placa a"} ${card.name}`}>
                {card.plate ? "Trocar" : "Atribuir"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {openCard ? (
        <AssignOnePlateDialog
          card={openCard}
          open
          onOpenChange={(open) => !open && setOpenCard(null)}
          onDone={() => {
            setOpenCard(null);
            onChanged();
          }}
        />
      ) : null}
    </section>
  );
}
