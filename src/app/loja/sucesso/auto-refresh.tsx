"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Enquanto o pagamento ainda está sendo confirmado (o webhook do Stripe chega
 * alguns segundos depois do retorno), recarrega os dados da página a cada
 * `everyMs`, por no máximo `maxTimes` vezes (~3 min). Quando o pedido muda de
 * estado, o servidor entrega a tela nova e este componente some.
 */
export function AutoRefresh({ everyMs = 5000, maxTimes = 36 }: { everyMs?: number; maxTimes?: number }) {
  const router = useRouter();

  useEffect(() => {
    let runs = 0;
    const id = setInterval(() => {
      runs += 1;
      router.refresh();
      if (runs >= maxTimes) clearInterval(id);
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, maxTimes]);

  return null;
}
