import type { StoreOrderStatus } from "@/generated/prisma/client";

/**
 * O que a página de acompanhamento (`/loja/sucesso`) diz sobre o pedido.
 *
 * Antes, o título era sempre "Pedido confirmado!" com um ícone de sucesso — até
 * abrindo a página sem pedido nenhum, com pagamento ainda pendente, cancelado ou
 * reembolsado. Aqui o título sai do estado REAL do pedido; a página nunca afirma
 * o que o banco não confirma.
 */
export type SuccessViewKind = "CONFIRMED" | "AWAITING_PAYMENT" | "CANCELED" | "REFUNDED" | "NOT_FOUND";

export interface SuccessView {
  kind: SuccessViewKind;
  title: string;
  /** Texto de apoio; `null` quando a página mostra o resumo do pedido. */
  description: string | null;
  /** Só o pagamento pendente se resolve sozinho: a página se atualiza enquanto espera. */
  autoRefresh: boolean;
}

export function successView(order: { status: StoreOrderStatus } | null): SuccessView {
  if (!order) {
    return {
      kind: "NOT_FOUND",
      title: "Não encontramos este pedido",
      description: "Abra esta página pelo link que você recebeu ao concluir a compra. Se você acabou de pagar, espere um minuto e atualize.",
      autoRefresh: false,
    };
  }
  switch (order.status) {
    case "PENDING_PAYMENT":
      return {
        kind: "AWAITING_PAYMENT",
        title: "Confirmando o seu pagamento…",
        description: "Assim que o pagamento for confirmado, esta página mostra o andamento do pedido. Costuma levar alguns segundos.",
        autoRefresh: true,
      };
    case "CANCELED":
      return {
        kind: "CANCELED",
        title: "Pedido cancelado",
        description: "Este pedido foi cancelado. Se você acha que foi um engano, fale com a gente.",
        autoRefresh: false,
      };
    case "REFUNDED":
      return {
        kind: "REFUNDED",
        title: "Pedido reembolsado",
        description: "O valor deste pedido foi devolvido. Se tiver dúvida sobre quando ele aparece no seu cartão ou conta, fale com a gente.",
        autoRefresh: false,
      };
    case "PAID":
    case "SHIPPED":
    case "DELIVERED":
      return { kind: "CONFIRMED", title: "Pedido confirmado!", description: null, autoRefresh: false };
  }
}
