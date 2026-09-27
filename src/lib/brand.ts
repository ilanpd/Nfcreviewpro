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
  /** Frase-âncora. Trocada no C8 (F6, ADR-083): o Retorno está no ar desde o
   * C5, então "Faça cada cliente voltar" deixou de ser uma promessa vazia —
   * é literalmente o que o produto faz. Antes disso, era
   * "Um toque leva o cliente até a avaliação no Google" (nunca falar do que
   * não existe ainda). */
  tagline: "Faça cada cliente voltar",
  description:
    "Um cartão que o cliente encosta no celular para avaliar no Google ou falar com você, e um brinde para ele voltar. Sem aplicativo e sem cadastro.",
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
