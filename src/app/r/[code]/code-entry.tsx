"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CardApi } from "@/lib/return-offer/client-api";
import { screenForLookedUpVoucher, type TouchScreen } from "@/domain/return-offer/public-screen";

/**
 * "Já tem um brinde? Digite o código" (ADR-080): o cliente trocou de celular ou
 * limpou o navegador. O código é a credencial dele, então a consulta não pede
 * PIN. Mensagem de erro específica, sem revelar nada de outro negócio.
 */
export function CodeEntry({
  api,
  onFound,
  initiallyOpen = false,
  autoCode,
}: {
  api: CardApi;
  onFound: (screen: TouchScreen) => void;
  initiallyOpen?: boolean;
  autoCode?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [value, setValue] = useState(autoCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  async function submit(code = value) {
    if (code.trim().length < 4 || busy) return;
    setBusy(true);
    setError(null);
    const result = await api.lookup(code);
    setBusy(false);
    if (result.ok) return onFound(screenForLookedUpVoucher(result.voucher));
    setError(result.message);
  }

  useEffect(() => {
    if (autoCode && !autoRan.current) {
      autoRan.current = true;
      void submit(autoCode);
    }
    // executa uma única vez, só no modo de teste
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-brand-ink underline underline-offset-4">
        Já tem um brinde? Digite o código
      </button>
    );
  }

  return (
    <form
      className="w-full space-y-2 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="voucher-code" className="text-sm font-medium">
        Código do seu brinde
      </label>
      <div className="flex gap-2">
        <input
          id="voucher-code"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={9}
          placeholder="K7X-4QM"
          aria-describedby={error ? "code-error" : undefined}
          aria-invalid={error ? true : undefined}
          className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 text-center font-mono text-xl tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" className="h-12 px-5" disabled={busy || value.trim().length < 4}>
          {busy ? "Buscando…" : "Ver brinde"}
        </Button>
      </div>
      {error ? (
        <p id="code-error" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
