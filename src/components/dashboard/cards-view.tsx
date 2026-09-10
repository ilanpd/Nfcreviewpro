"use client";

import { useMemo, useState } from "react";
import { CreditCard, Plus, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardFormDialog } from "@/components/dashboard/card-form-dialog";
import { CardItem } from "@/components/dashboard/card-item";
import type { BranchListItem, CardWithStats, ZoneListItem } from "@/types";
import type { NFCCard } from "@/generated/prisma/client";
import { EmptyState } from "@nfc-os/ui";

interface CardsViewProps {
  initialCards: CardWithStats[];
  cardLimit: number | null;
  initialBranches: BranchListItem[];
  initialZones: ZoneListItem[];
  canManage: boolean;
}

type StatusFilter = "ALL" | "ACTIVE" | "PAUSED";

export function CardsView({ initialCards, cardLimit, initialBranches, initialZones, canManage }: CardsViewProps) {
  const [cards, setCards] = useState(initialCards);
  const [branches] = useState(initialBranches);
  const [zones] = useState(initialZones);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");

  const limitReached = cardLimit !== null && cards.length >= cardLimit;

  const visibleCards = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesSearch =
        term === "" ||
        card.name.toLowerCase().includes(term) ||
        card.uniqueCode.toLowerCase().includes(term) ||
        card.tags.some((tag) => tag.toLowerCase().includes(term));
      const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? card.active : !card.active);
      const matchesZone = zoneFilter === "ALL" || card.zoneId === zoneFilter;
      return matchesSearch && matchesStatus && matchesZone;
    });
  }, [cards, search, statusFilter, zoneFilter]);

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
        <EmptyState
          icon={<CreditCard />}
          title="Nenhum cartão cadastrado ainda"
          description="Use o botão Novo cartão acima para criar o primeiro e começar a coletar avaliações."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou tag…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="ACTIVE">Ativo</SelectItem>
                <SelectItem value="PAUSED">Pausado</SelectItem>
              </SelectContent>
            </Select>
            {zones.length > 0 ? (
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as zonas</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {visibleCards.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title="Nenhum cartão corresponde aos filtros"
              description="Tente outro termo de busca ou limpe os filtros de status/zona."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleCards.map((card) => (
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
        </>
      )}
    </div>
  );
}
