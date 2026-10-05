"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlatePicker, isPickReady, pickToPayload, type PickValue } from "@/components/admin/plate-picker";

/**
 * Entrega placas do estoque aos cartões de um pedido que ainda não tem. O
 * cartão passa a usar o código da placa — por isso, se o cliente já tem painel
 * (pode ter baixado o QR antigo), o sistema pede confirmação antes de trocar.
 */
export function AssignPlatesDialog({ orderId, missing, onDone }: { orderId: string; missing: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<PickValue>({ mode: "LOT", batchId: "" });
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const payload = pickToPayload(pick);
    if (!payload) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/plates/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, pick: payload, acceptCodeChange: confirmMessage !== null }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "CODE_CHANGE_CONFIRMATION") return void setConfirmMessage(data.error);
        throw new Error(data.error ?? "Não foi possível atribuir as placas");
      }
      const serials = (data.assigned as { serial: string }[]).map((a) => a.serial).join(", ");
      toast.success(`Placas atribuídas: ${serials}`);
      setOpen(false);
      setConfirmMessage(null);
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
        setOpen(next);
        if (!next) setConfirmMessage(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <Boxes className="size-3.5" /> Atribuir as {missing} que faltam de um lote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Atribuir {missing} placa{missing === 1 ? "" : "s"} a este pedido
          </DialogTitle>
          <DialogDescription>Cada cartão do pedido que ainda não tem placa recebe uma, na ordem. Só placas já conferidas e sem dono podem ser entregues. Para escolher uma placa específica por cartão, use &ldquo;Atribuir&rdquo; na linha de cada um.</DialogDescription>
        </DialogHeader>
        <PlatePicker needed={missing} allowNone={false} value={pick} onChange={(v) => (setPick(v), setConfirmMessage(null))} idPrefix="assign" />
        {confirmMessage ? (
          <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
            {confirmMessage}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={busy || !isPickReady(pick, missing) || pick.mode === "NONE"} onClick={submit}>
            {busy ? "Atribuindo…" : confirmMessage ? "Entendi, atribuir mesmo assim" : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
