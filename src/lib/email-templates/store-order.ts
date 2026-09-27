import "server-only";
import { formatCentsToBRL } from "@/lib/store-products";
import { BRAND } from "@/lib/brand";

/**
 * E-mails transacionais do pedido da loja física (Auditoria do Fluxo de
 * Vendas, 12/09/2026). HTML com estilo inline de propósito — é o único jeito
 * de um template renderizar de forma consistente entre clientes de e-mail
 * (Gmail, Outlook, Apple Mail removem/ignoram `<style>` externo com
 * frequência). Layout deliberadamente simples (uma coluna, sem grid) pela
 * mesma razão.
 */

const WRAPPER_START = `
<div style="background:#F3F4F5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E3E5E8;">
    <div style="background:#16191C;padding:20px 28px;">
      <span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${BRAND.name}<span style="color:${BRAND.colors.amberOnDark};">.</span></span>
      <span style="display:block;color:#C9CDD2;font-size:12px;margin-top:2px;">Pedido de cartões NFC</span>
    </div>
    <div style="padding:28px;">
`;

const WRAPPER_END = `
    </div>
    <div style="padding:18px 28px;border-top:1px solid #E9EAEC;">
      <p style="margin:0;color:#5F656C;font-size:12px;">Dúvidas sobre seu pedido? Responda este e-mail diretamente.</p>
    </div>
  </div>
</div>
`;

function orderSummaryRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#5F656C;font-size:13px;">${label}</td>
    <td style="padding:6px 0;color:#16191C;font-size:13px;font-weight:600;text-align:right;">${value}</td>
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
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Recebemos seu pedido, ${order.customerName.split(" ")[0]}!</h1>
    <p style="margin:0 0 20px;color:#4A4F55;font-size:14px;line-height:1.6;">
      O pagamento foi confirmado e seu pedido <strong>#${order.orderShort}</strong> já entrou em produção.
      Assim que for enviado, você recebe outro e-mail com o código de rastreio.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#F3F4F5;border-radius:8px;padding:4px 14px;">
      ${orderSummaryRow("Produto", order.productLabel)}
      ${orderSummaryRow("Quantidade", `${order.quantity} cartão(ões)`)}
      ${orderSummaryRow("Total pago", formatCentsToBRL(order.amountTotalCents))}
    </table>
  ${WRAPPER_END}`;
}

export function shippedEmailHtml(order: OrderEmailBase & { trackingCode?: string | null; carrier?: string | null }): string {
  const trackingBlock = order.trackingCode
    ? `<table style="width:100%;border-collapse:collapse;background:#F3F4F5;border-radius:8px;padding:4px 14px;margin-top:16px;">
        ${orderSummaryRow("Transportadora", order.carrier ?? "—")}
        ${orderSummaryRow("Código de rastreio", order.trackingCode)}
       </table>`
    : "";
  return `${WRAPPER_START}
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Seu pedido está a caminho! 📦</h1>
    <p style="margin:0 0 4px;color:#4A4F55;font-size:14px;line-height:1.6;">
      O pedido <strong>#${order.orderShort}</strong> (${order.quantity} cartão(ões)) foi enviado.
    </p>
    ${trackingBlock}
  ${WRAPPER_END}`;
}

export function deliveredEmailHtml(order: OrderEmailBase): string {
  return `${WRAPPER_START}
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Pedido entregue ✅</h1>
    <p style="margin:0 0 20px;color:#4A4F55;font-size:14px;line-height:1.6;">
      O pedido <strong>#${order.orderShort}</strong> chegou até você. Esperamos que seus novos cartões NFC ajudem a
      colher ainda mais avaliações — qualquer dúvida na hora de colocar em uso, é só responder este e-mail.
    </p>
  ${WRAPPER_END}`;
}
