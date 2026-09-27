import "server-only";
import { BRAND } from "@/lib/brand";

/**
 * Layout compartilhado de e-mail transacional (C9/F6). Até aqui, cada
 * arquivo de template (`store-order.ts`, `meu-cartao.ts`) reescrevia à mão o
 * mesmo cabeçalho/rodapé com estilo inline — inevitável duplicar o CSS
 * inline em si (é o único jeito de um template renderizar de forma
 * consistente entre clientes de e-mail: Gmail/Outlook/Apple Mail removem ou
 * ignoram `<style>` externo com frequência), mas o HTML do cabeçalho/rodapé
 * não precisava divergir. Com 3+ arquivos de template agora, duplicar de
 * novo criaria 3 versões que vão se desalinhando aos poucos — um só lugar
 * evita isso.
 */
export function emailLayout(params: { eyebrow: string; bodyHtml: string; footerHtml?: string }): string {
  const { eyebrow, bodyHtml, footerHtml } = params;
  return `
<div style="background:#F3F4F5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E3E5E8;">
    <div style="background:#16191C;padding:20px 28px;">
      <span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${BRAND.name}<span style="color:${BRAND.colors.amberOnDark};">.</span></span>
      <span style="display:block;color:#C9CDD2;font-size:12px;margin-top:2px;">${eyebrow}</span>
    </div>
    <div style="padding:28px;">
      ${bodyHtml}
    </div>${
      footerHtml
        ? `
    <div style="padding:18px 28px;border-top:1px solid #E9EAEC;">
      <p style="margin:0;color:#5F656C;font-size:12px;">${footerHtml}</p>
    </div>`
        : ""
    }
  </div>
</div>`;
}

/** Linha de tabela "rótulo à esquerda, valor em negrito à direita" — usada em todo resumo dentro de um e-mail. */
export function emailSummaryRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#5F656C;font-size:13px;">${label}</td>
    <td style="padding:6px 0;color:#16191C;font-size:13px;font-weight:600;text-align:right;">${value}</td>
  </tr>`;
}

/** Botão de ação principal — mesmo tom âmbar da marca, para o único link que importa num e-mail transacional. */
export function emailButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:4px;padding:11px 20px;background:${BRAND.colors.ink};color:#FFFFFF;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>`;
}
