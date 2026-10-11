/**
 * Escapa texto para entrar no HTML de um e-mail (conteúdo de elemento OU valor de atributo entre aspas).
 *
 * Vários textos dos e-mails são digitados por quem não é de confiança: a mensagem do formulário de contato
 * (anônimo), a mensagem de um cliente no cartão, o nome de quem compra na loja, o nome da empresa. Sem escapar,
 * `<a href="https://golpe">` virava um link clicável dentro de um e-mail enviado pelo remetente OFICIAL do produto.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Endereço para `href`: só http(s) e mailto. Qualquer outro esquema (javascript:, data:) vira "#". Depois escapa
 * para o atributo.
 */
export function safeHref(url: string): string {
  const trimmed = String(url ?? "").trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? escapeHtml(trimmed) : "#";
}
