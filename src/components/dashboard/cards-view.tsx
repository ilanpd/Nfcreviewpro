"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardFormDialog } from "@/components/dashboard/card-form-dialog";
import { CardItem } from "@/components/dashboard/card-item";
import type { BranchListItem, CardWithStats, ZoneListItem } from "@/types";
import type { NFCCard } from "@/generated/prisma/client";

interface CardsViewProps {
  initialCards: CardWithStats[];
  cardLimit: number | null;
  initialBranches: BranchListItem[];
  initialZones: ZoneListItem[];
  canManage: boolean;
}

export function CardsView({ initialCards, cardLimit, initialBranches, initialZones, canManage }: CardsViewProps) {
  const [cards, setCards] = useState(initialCards);
  const [branches] = useState(initialBranches);
  const [zones] = useState(initialZones);

  const limitReached = cardLimit !== null && cards.length >= cardLimit;

  function handleCreated(card: NFCCard) {
    setCards((prev) => [{ ...card, _count: { visits: 0 } }, ...prev]);
  }

  function handleUpdated(card: NFCCard) {
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...card } : c)));
  }

  function handleDeleted(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cartões</h1>
          <p className="text-sm text-muted-foreground">
            {cards.length} {cardLimit !== null ? `de ${cardLimit}` : ""} cartão(ões) NFC
          </p>
        </div>
        {canManage ? (
          <CardFormDialog
            branches={branches}
            zones={zones}
            onSaved={handleCreated}
            trigger={
              <Button disabled={limitReached}>
                <Plus className="size-4" /> Novo cartão
              </Button>
            }
          />
        ) : null}
      </div>

      {limitReached ? (
        <Alert>
          <AlertTitle>Limite do plano atingido</AlertTitle>
          <AlertDescription>Faça upgrade do seu plano para cadastrar mais cartões NFC.</AlertDescription>
        </Alert>
      ) : null}

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nenhum cartão cadastrado ainda. Crie o primeiro para começar a coletar avaliações.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              branches={branches}
              zones={zones}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
