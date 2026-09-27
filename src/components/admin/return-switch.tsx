"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

/**
 * Controles do Retorno no Admin (ADR-079). Um só componente para os dois
 * interruptores, porque fazem a mesma coisa: ligar ou desligar e confirmar. O
 * do piloto liga o Retorno numa empresa; o geral desliga emissão e resgate para
 * todas, na hora, e por isso pede confirmação ao desligar.
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

  async function change(next: boolean) {
    if (!next && confirmOff && !confirm(confirmOff)) return;
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
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={enabled} disabled={busy} onCheckedChange={change} aria-label={label} />
    </div>
  );
}
