import { Package } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { currentStageLabel } from "@/domain/store-order/checklist";
import type { StoreOrder } from "@/generated/prisma/client";

/**
 * Motor de Ativação (Fase 18) — o pedido físico aparece dentro do próprio
 * Dashboard enquanto estiver em andamento, em vez de uma página separada:
 * quem já está logado no painel não deveria precisar sair dele para saber
 * onde está a encomenda que comprou. Some sozinho assim que o pedido chega
 * a Entregue (ver getInProgressOrderForCompany).
 */
export function OrderStatusBanner({ order }: { order: StoreOrder }) {
  return (
    <Alert>
      <Package />
      <AlertTitle>Pedido de {order.quantity} cartão(ões) em andamento</AlertTitle>
      <AlertDescription>{currentStageLabel(order)}</AlertDescription>
    </Alert>
  );
}
