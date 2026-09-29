"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

/**
 * Controles do Retorno no Admin (ADR-079). Um só componente para os dois
 * interruptores, porque fazem a mesma coisa: ligar ou desligar e confirmar. O
 * do piloto liga o Retorno numa empresa; o geral desliga emissão e resgate para
 * todas, na hora, e por isso pede confirmação ao desligar.
 *
 * Achado de auditoria total (29/09/2026): a confirmação usava
 * `window.confirm()` — sem estilo, sem chance de errar por clicar rápido
 * demais num diálogo nativo, e é justamente a ação mais consequente do
 * painel inteiro (o interruptor GERAL afeta toda empresa, na hora). Mesmo
 * `ConfirmDialog` já usado no resto do painel (campanhas, cartões, equipe,
 * mesas, brindes).
 */
export function ReturnSwitch({
  endpoint,
  initialEnabled,
  label,
  description,
  confirmOff,
}: {
  endpoint: string;
  initialEnabled: boolean;
  label: string;
  description: string;
  /** Texto de confirmação ao desligar; sem ele, desliga direto. */
  confirmOff?: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);

  async function apply(next: boolean) {
    setBusy(true);
    const previous = enabled;
    setEnabled(next);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? "Ligado" : "Desligado");
    } catch {
      setEnabled(previous);
      toast.error("Não foi possível alterar. Tente de novo.");
    } finally {
      setBusy(false);
      setConfirmingOff(false);
    }
  }

  function change(next: boolean) {
    if (!next && confirmOff) {
      setConfirmingOff(true);
      return;
    }
    void apply(next);
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={enabled} disabled={busy} onCheckedChange={change} aria-label={label} />

      {confirmOff ? (
        <ConfirmDialog
          open={confirmingOff}
          onOpenChange={setConfirmingOff}
          title="Desligar?"
          description={confirmOff}
          confirmLabel="Desligar"
          busy={busy}
          onConfirm={() => apply(false)}
        />
      ) : null}
    </div>
  );
}
