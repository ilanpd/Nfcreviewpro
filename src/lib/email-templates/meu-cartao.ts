import "server-only";
import { emailLayout } from "@/lib/email-templates/layout";

/**
 * E-mail de recuperação do link pessoal do cartão avulso (ADR-080, J7 do
 * plano). Cabeçalho/rodapé vêm de `email-templates/layout.ts` (C9/F6).
 */
export function personalLinkRecoveryEmailHtml(links: { name: string; url: string }[]): string {
  const rows = links
    .map(
      (link) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #E3E5E8;">
          <p style="margin:0 0 4px;color:#16191C;font-size:14px;font-weight:600;">${link.name}</p>
          <a href="${link.url}" style="color:#5A47D6;font-size:13px;word-break:break-all;">${link.url}</a>
        </td>
      </tr>`
    )
    .join("");

  return emailLayout({
    eyebrow: "Seus links de cartão",
    footerHtml: "Não pediu isso? Pode ignorar este e-mail com segurança.",
    bodyHtml: `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Aqui estão seus links</h1>
    <p style="margin:0 0 20px;color:#4A4F55;font-size:14px;line-height:1.6;">
      Use o link de cada cartão para trocar para onde ele redireciona, a qualquer momento, sem precisar de conta.
    </p>
    <table style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>`,
  });
}
