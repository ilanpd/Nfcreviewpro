"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CardApi } from "@/lib/return-offer/client-api";

/**
 * Resgate com o PIN da loja (ADR-080), feito na tela do cliente com o atendente
 * ao lado. O PIN é digitado numa entrada numérica escondida; erro de PIN diz
 * quantas tentativas restam e, no bloqueio, até que horas. Aceita um PIN e uma
 * tentativa pré-preenchidos só para o modo de teste do dono mostrar o estado 9.
 */
export function RedeemPanel({
  api,
  code,
  onRedeemed,
  onCancel,
  autoPin,
}: {
  api: CardApi;
  code: string;
  onRedeemed: (title: string) => void;
  onCancel: () => void;
  autoPin?: string;
}) {
  const [pin, setPin] = useState(autoPin ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  async function submit(value = pin) {
    if (!/^\d{4}$/.test(value) || busy) return;
    setBusy(true);
    setError(null);
    const result = await api.redeem(code, value);
    setBusy(false);
    if (result.ok) return onRedeemed(result.title);

    setPin("");
    if (result.reason === "WRONG_PIN") {
      const left = result.remainingAttempts;
      setError(left !== undefined ? `PIN incorreto. ${left === 1 ? "Resta 1 tentativa." : `Restam ${left} tentativas.`}` : "PIN incorreto.");
    } else if (result.reason === "TOO_MANY_ATTEMPTS" && result.retryAt) {
      const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(result.retryAt));
      setError(`Muitas tentativas. Tente de novo depois das ${time}.`);
    } else {
      setError(result.message);
    }
  }

  useEffect(() => {
    if (autoPin && !autoRan.current) {
      autoRan.current = true;
      void submit(autoPin);
    }
    // executa uma única vez, só no modo de teste
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form
      className="w-full space-y-3 rounded-2xl border border-border bg-card p-5 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <p className="text-base font-semibold">Confirme o resgate</p>
        <p className="text-sm text-muted-foreground">Peça ao atendente para digitar o PIN da loja.</p>
      </div>
      <label htmlFor="pin" className="sr-only">
        PIN da loja
      </label>
      <input
        id="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        maxLength={4}
        pattern="\d{4}"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        aria-describedby={error ? "pin-error" : undefined}
        aria-invalid={error ? true : undefined}
        className="h-14 w-full rounded-xl border border-input bg-background text-center font-mono text-3xl tracking-[0.6em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error ? (
        <p id="pin-error" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onCancel} disabled={busy}>
          Voltar
        </Button>
        <Button type="submit" className="h-12" disabled={busy || pin.length !== 4}>
          {busy ? "Confirmando…" : "Confirmar resgate"}
        </Button>
      </div>
    </form>
  );
}
