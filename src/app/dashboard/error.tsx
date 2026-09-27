"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Ver comentário de global-error.tsx — este nível preserva a sidebar do
 * Dashboard (o layout continua renderizado por fora deste boundary), só a
 * área de conteúdo mostra o erro em vez de derrubar a sessão inteira. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <p className="text-lg font-semibold">Não foi possível carregar esta página</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Algo deu errado do nosso lado. Tente novamente — se persistir, fale com o suporte.
      </p>
      <Button onClick={reset}>Tentar de novo</Button>
    </div>
  );
}
