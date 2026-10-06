"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

/**
 * Segurança/confiabilidade (Auditoria Nível Bilionário, 11/09/2026) — antes
 * deste arquivo, NENHUM error boundary existia em `src/app` inteiro (nem
 * este, nem um `error.tsx` por rota). Um erro não tratado em qualquer
 * Server Component derrubava a página inteira para a tela de erro genérica
 * do próprio Next.js, sem marca nenhuma e sem botão de recuperação.
 * `global-error.tsx` é o único nível que também cobre uma falha dentro do
 * layout raiz — precisa renderizar `<html>`/`<body>` próprios porque
 * substitui o layout inteiro quando aciona.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    // Sem isto, um erro de tela fica só no navegador do cliente e ninguém fica sabendo (no-op sem DSN).
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-lg font-semibold">Algo deu errado</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {/* Só promete aviso quando o Sentry está ligado: nunca afirmar o que não acontece. */}
            {process.env.NEXT_PUBLIC_SENTRY_DSN ? "Nosso time já foi avisado. " : ""}Tente novamente em instantes.
          </p>
          <Button onClick={reset}>Tentar de novo</Button>
        </main>
      </body>
    </html>
  );
}
