/**
 * Identidade da plataforma (ADR-077). Única fonte do nome, do tom e das cores
 * da marca Pulse para todo texto e asset gerado pelo código (telas, metadados,
 * e-mails, PDFs, planilhas, Stripe, ícones). Nenhum arquivo escreve o nome à
 * mão: `domain/brand/sem-nome-antigo.test.ts` falha se "NFC OS" ou
 * "NFC Review Pro" voltarem a aparecer em código de interface.
 *
 * Não confundir com a marca da EMPRESA cliente (`BrandConfig`, White Label):
 * essa vem do banco e vale nas telas do cliente do dono. Esta é a marca de
 * quem vende o produto.
 *
 * Seguro para o navegador: sem `process.env`, sem I/O.
 */
export const BRAND = {
  name: "Pulse",
  /** Frase-âncora: só afirma o que o produto faz HOJE. Trocar por "Faça cada
   * cliente voltar" quando o Retorno estiver no ar (F6): prometer antes seria
   * anunciar recurso que não existe. */
  tagline: "Um toque leva o cliente até a avaliação no Google",
  description:
    "Cartões NFC que levam o cliente direto para avaliar no Google ou falar com o seu negócio, sem aplicativo e sem cadastro.",
  /** Cores como hex puro, para quem não enxerga o CSS (OG, ícones, e-mail, PDF). Espelham `globals.css` (verificado em teste). */
  colors: {
    ink: "#16191C",
    graphite: "#4A4F55",
    amber: "#C9741A",
    amberOnDark: "#F2A04D",
    paper: "#FFFFFF",
  },
} as const;

export function copyright(year: number): string {
  return `© ${year} ${BRAND.name}. Todos os direitos reservados.`;
}

/** Título de página no formato "Assunto — Pulse". */
export function pageTitle(subject: string): string {
  return `${subject} — ${BRAND.name}`;
}
