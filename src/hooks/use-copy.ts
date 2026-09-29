"use client";

import { useCallback, useState } from "react";

/**
 * Copiar texto pra área de transferência (ADR-080, movido de `app/r/[code]`
 * pra `hooks/` na auditoria de 28/09/2026 pra ser reaproveitado fora do
 * cartão público — `loja/sucesso/edit-link-list.tsx` reimplementava a mesma
 * ideia com `navigator.clipboard.writeText` cru, sem fallback e SEM checar
 * se deu certo: um clipboard bloqueado (contexto inseguro, permissão negada,
 * navegador embutido do Instagram/WhatsApp) mostrava "Link copiado" mesmo
 * quando nada foi copiado). Aqui: uma segunda via (`execCommand`) e, se
 * nenhuma funcionar, o estado diz a verdade em vez de fingir sucesso.
 */
export type CopyState = "idle" | "copied" | "manual";

/** Exportado pra quem prefere um toast a um estado persistente na tela (ex.:
 * um item de menu que fecha assim que é clicado — `card-item.tsx`). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // cai para a segunda via
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function useCopy(text: string) {
  const [state, setState] = useState<CopyState>("idle");

  const copy = useCallback(async () => {
    const ok = await copyText(text);
    setState(ok ? "copied" : "manual");
    if (ok) setTimeout(() => setState("idle"), 2500);
  }, [text]);

  return { state, copy };
}

/** O menu nativo de compartilhar, quando existe. */
export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function nativeShare(text: string): Promise<void> {
  try {
    await navigator.share({ text });
  } catch {
    // o cliente fechou o menu: não é erro
  }
}
