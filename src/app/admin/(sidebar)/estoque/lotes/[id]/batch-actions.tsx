"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Os dois marcos do lote. Não têm "desfazer", então pedem confirmação. */
export function BatchActions({ batchId, code, sentAt, receivedAt }: { batchId: string; code: string; sentAt: string | null; receivedAt: string | null }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"send" | "receive" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "send" | "receive") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plates/batches/${batchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível atualizar o lote");
      toast.success(action === "send" ? `Lote ${code} marcado como enviado à gráfica.` : `Lote ${code} marcado como recebido. Agora é só conferir.`);
      setDialog(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!sentAt ? (
        <Button onClick={() => setDialog("send")}>
          <Send className="size-4" /> Marcar como enviado à gráfica
        </Button>
      ) : null}
      {sentAt && !receivedAt ? (
        <Button onClick={() => setDialog("receive")}>
          <PackageCheck className="size-4" /> Marcar como recebido
        </Button>
      ) : null}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "send" ? `Lote ${code} foi enviado à gráfica?` : `Lote ${code} chegou?`}</DialogTitle>
            <DialogDescription>
              {dialog === "send"
                ? "As placas passam para \"Em produção\" e a data fica registrada no histórico de cada uma."
                : "Marque quando o pacote estiver na sua mão. Depois use \"Conferir lote\" para testar cada placa."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Ainda não
            </Button>
            <Button disabled={busy} onClick={() => dialog && run(dialog)}>
              {busy ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
