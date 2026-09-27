"use client";

import { useCallback, useState } from "react";

/**
 * Copiar o código (ADR-080). Em navegadores embutidos (Instagram, WhatsApp) a
 * área de transferência moderna pode não existir, então há uma segunda via e,
 * se nenhuma funcionar, o cliente é orientado a copiar à mão. Nunca engole a
 * falha em silêncio: o estado diz o que aconteceu.
 */
export type CopyState = "idle" | "copied" | "manual";

async function copyText(text: string): Promise<boolean> {
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
