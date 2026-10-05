"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStock } from "@/components/admin/plate-picker";

export interface OrderCard {
  id: string;
  name: string;
  uniqueCode: string;
  /** `null` quando o endereço do cartão ainda não é o definitivo e o ambiente o exige (ADR-076). */
  publicUrl: string | null;
  plate: { serial: string; status: string; batchCode?: string } | null;
}

interface AvailablePlate {
  id: string;
  serial: string;
}

/**
 * Liga UMA placa do estoque a UM cartão do pedido: primeiro o LOTE (a lista mostra
 * quantas placas conferidas cada lote ainda tem, do mais antigo ao mais novo), depois
 * a placa — a mais baixa do lote já vem marcada, mas qualquer outra pode ser escolhida.
 * Num cartão que já tem placa, vira "trocar" e a antiga fica defeituosa.
 */
export function AssignOnePlateDialog({ card, open, onOpenChange, onDone }: { card: OrderCard; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const stock = useStock();
  const lots = stock?.lots ?? null;
  const replacing = card.plate !== null;

  const [lotId, setLotId] = useState("");
  const [plates, setPlates] = useState<AvailablePlate[] | null>(null);
  const [plateId, setPlateId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // o lote mais antigo com estoque vem escolhido
  useEffect(() => {
    if (open && lots && lots.length > 0 && !lots.some((l) => l.id === lotId)) setLotId(lots[0].id);
  }, [open, lots, lotId]);

  // as placas do lote escolhido
  useEffect(() => {
    if (!open || !lotId) return;
    let cancelled = false;
    setPlates(null);
    void fetch(`/api/admin/plates/available?batchId=${encodeURIComponent(lotId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list: AvailablePlate[] = data.plates ?? [];
        setPlates(list);
        setPlateId(list[0]?.id ?? "");
      })
      .catch(() => !cancelled && setPlates([]));
    return () => {
      cancelled = true;
    };
  }, [open, lotId]);

  const chosen = plates?.find((p) => p.id === plateId) ?? null;

  async function submit() {
    if (!chosen) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plates/${chosen.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, replace: replacing, replaceReason: reason.trim() || undefined, acceptCodeChange: confirmMessage !== null }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "CODE_CHANGE_CONFIRMATION") return void setConfirmMessage(data.error);
        throw new Error(data.error ?? "Não foi possível atribuir a placa");
      }
      toast.success(replacing ? `Placa trocada: ${card.plate?.serial} → ${chosen.serial}.` : `Placa ${chosen.serial} atribuída a ${card.name}.`);
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setConfirmMessage(null);
          setReason("");
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{replacing ? `Trocar a placa de ${card.name}` : `Atribuir placa a ${card.name}`}</DialogTitle>
          <DialogDescription>
            {replacing
              ? `Hoje o cartão usa a placa ${card.plate?.serial}. A nova entra no lugar e a atual vira defeituosa.`
              : "Escolha o lote e depois a placa. Só aparecem placas já conferidas e sem dono."}
          </DialogDescription>
        </DialogHeader>

        {lots === null ? <p className="text-sm text-muted-foreground">Carregando o estoque…</p> : null}

        {lots !== null && lots.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">Não há placa conferida e sem dono no estoque.</p>
            <p className="mt-1 text-muted-foreground">
              Confira as placas de um lote recebido para elas aparecerem aqui.{" "}
              <Link href="/admin/estoque/lotes" className="underline underline-offset-4">
                Abrir lotes
              </Link>
            </p>
          </div>
        ) : null}

        {lots !== null && lots.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>1. Lote</Label>
              <div role="group" aria-label="Lote da placa" className="grid gap-2 sm:grid-cols-2">
                {lots.map((lot) => (
                  <button
                    key={lot.id}
                    type="button"
                    aria-pressed={lot.id === lotId}
                    onClick={() => {
                      setLotId(lot.id);
                      setConfirmMessage(null);
                    }}
                    className={cn("rounded-lg border p-2.5 text-left transition-colors", lot.id === lotId ? "border-brand bg-brand-subtle" : "hover:bg-muted")}
                  >
                    <span className="block font-mono text-sm font-semibold">{lot.code}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {lot.modelName} · {lot.inStock} em estoque
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>2. Placa</Label>
              {plates === null ? <p className="text-sm text-muted-foreground">Carregando as placas do lote…</p> : null}
              {plates !== null && plates.length === 0 ? <p className="text-sm text-muted-foreground">Este lote não tem mais placas disponíveis.</p> : null}
              {plates !== null && plates.length > 0 ? (
                <div role="group" aria-label="Placa do lote" className="grid max-h-44 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4">
                  {plates.map((plate, i) => (
                    <button
                      key={plate.id}
                      type="button"
                      aria-pressed={plate.id === plateId}
                      onClick={() => {
                        setPlateId(plate.id);
                        setConfirmMessage(null);
                      }}
                      className={cn("rounded-md border px-2 py-1.5 text-center font-mono text-sm transition-colors", plate.id === plateId ? "border-brand bg-brand-subtle font-semibold" : "hover:bg-muted")}
                    >
                      {plate.serial}
                      {i === 0 ? <span className="block font-sans text-[10px] font-normal text-muted-foreground">próxima</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {replacing ? (
              <div className="space-y-1.5">
                <Label htmlFor="swap-reason">Motivo da troca (opcional)</Label>
                <Input id="swap-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: o NFC não lê" />
              </div>
            ) : null}

            {confirmMessage ? (
              <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
                {confirmMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={busy || !chosen} onClick={submit}>
            {busy ? "Salvando…" : confirmMessage ? "Entendi, atribuir mesmo assim" : chosen ? `${replacing ? "Trocar para" : "Atribuir"} ${chosen.serial}` : "Escolha uma placa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
