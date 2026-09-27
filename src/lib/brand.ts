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
  /** Nome formal completo (C11, ADR-086) — usado nos lugares mais solenes
   * (rodapé/copyright, a linha de posicionamento do Hero), nunca no dia a
   * dia da interface: "Pulse" sozinho é o que cabe num botão, numa aba do
   * navegador, num item de sidebar, sem soar burocrático a cada aparição —
   * o mesmo padrão de uma razão social formal x o nome com que a marca fala
   * com o cliente. */
  fullName: "Pulse Smart Link",
  /** Frase-âncora. Trocada no C8 (F6, ADR-083): o Retorno está no ar desde o
   * C5, então "Faça cada cliente voltar" deixou de ser uma promessa vazia —
   * é literalmente o que o produto faz. Antes disso, era
   * "Um toque leva o cliente até a avaliação no Google" (nunca falar do que
   * não existe ainda). */
  tagline: "Faça cada cliente voltar",
  /** Posicionamento formal (C11) — "o sistema operacional do marketing
   * físico": a mesma ideia de sempre (o cartão NFC conectado a um destino
   * inteligente), só nomeada como categoria, para o mercado que ainda não
   * conhece o produto. */
  positioning: "O sistema operacional do marketing físico",
  description:
    "Um cartão que o cliente encosta no celular para avaliar no Google ou falar com você, e um brinde para ele voltar. Sem aplicativo e sem cadastro.",
  /** Cores como hex puro, para quem não enxerga o CSS (OG, ícones, e-mail, PDF). Espelham `globals.css` (verificado em teste).
   * C11 (ADR-086) — o laranja saiu: `violet`/`violetOnDark` substituem
   * `amber`/`amberOnDark`; `ink`/`graphite` escureceram um grau, pro mesmo
   * tom "preto profundo" frio do resto da nova direção visual. */
  colors: {
    ink: "#0B0B0D",
    graphite: "#55565F",
    violet: "#6C5CE7",
    violetOnDark: "#A78BFA",
    paper: "#FFFFFF",
  },
} as const;

export function copyright(year: number): string {
  return `© ${year} ${BRAND.fullName}. Todos os direitos reservados.`;
}

/** Título de página no formato "Assunto — Pulse". */
export function pageTitle(subject: string): string {
  return `${subject} — ${BRAND.name}`;
}
