"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Baixa um arquivo gerado pelo servidor. Usa `fetch` (e não um link direto)
 * para que uma recusa — endereço provisório bloqueado, lote inexistente — vire
 * um aviso legível, em vez de o navegador baixar um JSON de erro com nome de PDF.
 */
export function DownloadButton({
  href,
  children,
  variant = "outline",
  size = "default",
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível gerar o arquivo");
      }
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "arquivo";
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={download} disabled={busy || disabled} aria-busy={busy}>
      {busy ? "Gerando…" : children}
    </Button>
  );
}
