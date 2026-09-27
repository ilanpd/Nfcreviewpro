import "server-only";
import { formatCentsToBRL } from "@/lib/store-products";

/**
 * E-mails transacionais do pedido da loja física (Auditoria do Fluxo de
 * Vendas, 12/09/2026). HTML com estilo inline de propósito — é o único jeito
 * de um template renderizar de forma consistente entre clientes de e-mail
 * (Gmail, Outlook, Apple Mail removem/ignoram `<style>` externo com
 * frequência). Layout deliberadamente simples (uma coluna, sem grid) pela
 * mesma razão.
 */

const WRAPPER_START = `
<div style="background:#f5f2ec;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e2d6;">
    <div style="background:#1d1a15;padding:20px 28px;">
      <span style="color:#f0e1d5;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Pedido de cartões NFC</span>
    </div>
    <div style="padding:28px;">
`;

const WRAPPER_END = `
    </div>
    <div style="padding:18px 28px;border-top:1px solid #efece4;">
      <p style="margin:0;color:#8a8171;font-size:12px;">Dúvidas sobre seu pedido? Responda este e-mail diretamente.</p>
    </div>
  </div>
</div>
`;

function orderSummaryRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#8a8171;font-size:13px;">${label}</td>
    <td style="padding:6px 0;color:#1d1a15;font-size:13px;font-weight:600;text-align:right;">${value}</td>
  </tr>`;
}

interface OrderEmailBase {
  customerName: string;
  orderShort: string;
  productLabel: string;
  quantity: number;
  amountTotalCents: number;
}

export function confirmationEmailHtml(order: OrderEmailBase): string {
  return `${WRAPPER_START}
    <h1 style="margin:0 0 6px;font-size:20px;color:#1d1a15;">Recebemos seu pedido, ${order.customerName.split(" ")[0]}!</h1>
    <p style="margin:0 0 20px;color:#5c5346;font-size:14px;line-height:1.6;">
      O pagamento foi confirmado e seu pedido <strong>#${order.orderShort}</strong> já entrou em produção.
      Assim que for enviado, você recebe outro e-mail com o código de rastreio.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#f7f5f1;border-radius:8px;padding:4px 14px;">
      ${orderSummaryRow("Produto", order.productLabel)}
      ${orderSummaryRow("Quantidade", `${order.quantity} cartão(ões)`)}
      ${orderSummaryRow("Total pago", formatCentsToBRL(order.amountTotalCents))}
    </table>
  ${WRAPPER_END}`;
}

export function shippedEmailHtml(order: OrderEmailBase & { trackingCode?: string | null; carrier?: string | null }): string {
  const trackingBlock = order.trackingCode
    ? `<table style="width:100%;border-collapse:collapse;background:#f7f5f1;border-radius:8px;padding:4px 14px;margin-top:16px;">
        ${orderSummaryRow("Transportadora", order.carrier ?? "—")}
        ${orderSummaryRow("Código de rastreio", order.trackingCode)}
       </table>`
    : "";
  return `${WRAPPER_START}
    <h1 style="margin:0 0 6px;font-size:20px;color:#1d1a15;">Seu pedido está a caminho! 📦</h1>
    <p style="margin:0 0 4px;color:#5c5346;font-size:14px;line-height:1.6;">
      O pedido <strong>#${order.orderShort}</strong> (${order.quantity} cartão(ões)) foi enviado.
    </p>
    ${trackingBlock}
  ${WRAPPER_END}`;
}

export function deliveredEmailHtml(order: OrderEmailBase): string {
  return `${WRAPPER_START}
    <h1 style="margin:0 0 6px;font-size:20px;color:#1d1a15;">Pedido entregue ✅</h1>
    <p style="margin:0 0 20px;color:#5c5346;font-size:14px;line-height:1.6;">
      O pedido <strong>#${order.orderShort}</strong> chegou até você. Esperamos que seus novos cartões NFC ajudem a
      colher ainda mais avaliações — qualquer dúvida na hora de colocar em uso, é só responder este e-mail.
    </p>
  ${WRAPPER_END}`;
}
