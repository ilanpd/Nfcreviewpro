import "server-only";
import { formatCentsToBRL } from "@/lib/store-products";
import { emailLayout, emailSummaryRow } from "@/lib/email-templates/layout";

/**
 * E-mails transacionais do pedido da loja física (Auditoria do Fluxo de
 * Vendas, 12/09/2026). Cabeçalho/rodapé vêm de `email-templates/layout.ts`
 * (C9/F6) — só o miolo de cada e-mail muda aqui.
 */

interface OrderEmailBase {
  customerName: string;
  orderShort: string;
  productLabel: string;
  quantity: number;
  amountTotalCents: number;
}

const FOOTER = "Dúvidas sobre seu pedido? Responda este e-mail diretamente.";

export function confirmationEmailHtml(order: OrderEmailBase): string {
  return emailLayout({
    eyebrow: "Pedido de cartões NFC",
    footerHtml: FOOTER,
    bodyHtml: `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Recebemos seu pedido, ${order.customerName.split(" ")[0]}!</h1>
    <p style="margin:0 0 20px;color:#4A4F55;font-size:14px;line-height:1.6;">
      O pagamento foi confirmado e seu pedido <strong>#${order.orderShort}</strong> já entrou em produção.
      Assim que for enviado, você recebe outro e-mail com o código de rastreio.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#F3F4F5;border-radius:8px;padding:4px 14px;">
      ${emailSummaryRow("Produto", order.productLabel)}
      ${emailSummaryRow("Quantidade", `${order.quantity} cartão(ões)`)}
      ${emailSummaryRow("Total pago", formatCentsToBRL(order.amountTotalCents))}
    </table>`,
  });
}

export function shippedEmailHtml(order: OrderEmailBase & { trackingCode?: string | null; carrier?: string | null }): string {
  const trackingBlock = order.trackingCode
    ? `<table style="width:100%;border-collapse:collapse;background:#F3F4F5;border-radius:8px;padding:4px 14px;margin-top:16px;">
        ${emailSummaryRow("Transportadora", order.carrier ?? "—")}
        ${emailSummaryRow("Código de rastreio", order.trackingCode)}
       </table>`
    : "";
  return emailLayout({
    eyebrow: "Pedido de cartões NFC",
    footerHtml: FOOTER,
    bodyHtml: `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Seu pedido está a caminho! 📦</h1>
    <p style="margin:0 0 4px;color:#4A4F55;font-size:14px;line-height:1.6;">
      O pedido <strong>#${order.orderShort}</strong> (${order.quantity} cartão(ões)) foi enviado.
    </p>
    ${trackingBlock}`,
  });
}

export function deliveredEmailHtml(order: OrderEmailBase): string {
  return emailLayout({
    eyebrow: "Pedido de cartões NFC",
    footerHtml: FOOTER,
    bodyHtml: `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Pedido entregue ✅</h1>
    <p style="margin:0 0 20px;color:#4A4F55;font-size:14px;line-height:1.6;">
      O pedido <strong>#${order.orderShort}</strong> chegou até você. Esperamos que seus novos cartões NFC ajudem a
      colher ainda mais avaliações — qualquer dúvida na hora de colocar em uso, é só responder este e-mail.
    </p>`,
  });
}
