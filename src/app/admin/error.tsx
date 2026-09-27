"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Ver comentário de global-error.tsx / dashboard/error.tsx — mesmo padrão,
 * escopado ao Painel Admin. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <p className="text-lg font-semibold">Não foi possível carregar esta página</p>
      <p className="max-w-sm text-sm text-muted-foreground">Algo deu errado. Tente novamente.</p>
      <Button onClick={reset}>Tentar de novo</Button>
    </div>
  );
}
