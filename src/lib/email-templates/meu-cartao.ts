import "server-only";
import { BRAND } from "@/lib/brand";

/**
 * E-mail de recuperação do link pessoal do cartão avulso (ADR-080, J7 do
 * plano). Mesma paleta e estrutura de `email-templates/store-order.ts` —
 * arquivo próprio porque a lista de links tem tamanho variável (um card por
 * cartão), diferente do resumo de pedido de lá.
 */
export function personalLinkRecoveryEmailHtml(links: { name: string; url: string }[]): string {
  const rows = links
    .map(
      (link) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #E3E5E8;">
          <p style="margin:0 0 4px;color:#16191C;font-size:14px;font-weight:600;">${link.name}</p>
          <a href="${link.url}" style="color:#93520D;font-size:13px;word-break:break-all;">${link.url}</a>
        </td>
      </tr>`
    )
    .join("");

  return `
<div style="background:#F3F4F5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E3E5E8;">
    <div style="background:#16191C;padding:20px 28px;">
      <span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${BRAND.name}<span style="color:${BRAND.colors.amberOnDark};">.</span></span>
      <span style="display:block;color:#C9CDD2;font-size:12px;margin-top:2px;">Seus links de cartão</span>
    </div>
    <div style="padding:28px;">
      <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Aqui estão seus links</h1>
      <p style="margin:0 0 20px;color:#4A4F55;font-size:14px;line-height:1.6;">
        Use o link de cada cartão para trocar para onde ele redireciona, a qualquer momento, sem precisar de conta.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
    </div>
    <div style="padding:18px 28px;border-top:1px solid #efece4;">
      <p style="margin:0;color:#4A4F55;font-size:12px;">Não pediu isso? Pode ignorar este e-mail com segurança.</p>
    </div>
  </div>
</div>`;
}
