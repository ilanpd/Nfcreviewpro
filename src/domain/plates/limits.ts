/**
 * Estoque de placas (ADR-092) — limites de tamanho dos arquivos. A Vercel
 * entrega no máximo ~4,5 MB por resposta de função; um PDF acima disso falha
 * com um erro opaco. As travas abaixo falham ANTES, com uma mensagem que diz o
 * que fazer.
 */

const MB = 1024 * 1024;

/** Teto do arquivo que o painel entrega (folga abaixo dos 4,5 MB da plataforma). */
export const MAX_DELIVERABLE_BYTES = 4.3 * MB;

/** Teto de um PDF de UMA página com a arte nova: o resto do espaço fica para as páginas do lote. */
export const MAX_SINGLE_PAGE_PDF_BYTES = 3.2 * MB;

export function formatMegabytes(bytes: number): string {
  return `${(bytes / MB).toFixed(1).replace(".", ",")} MB`;
}

/** `null` quando cabe; senão, a frase para o operador. */
export function deliverableProblem(bytes: number): string | null {
  if (bytes <= MAX_DELIVERABLE_BYTES) return null;
  return `O arquivo ficou com ${formatMegabytes(bytes)}, acima dos ${formatMegabytes(MAX_DELIVERABLE_BYTES)} que o servidor consegue entregar. Baixe o lote em partes menores (selecione placas na tabela e use "Reimprimir só estas") ou use uma arte em JPG, que pesa muito menos que PNG.`;
}

/** `null` quando a arte cabe; senão, a frase para o operador na hora do upload. */
export function artProblem(singlePagePdfBytes: number): string | null {
  if (singlePagePdfBytes <= MAX_SINGLE_PAGE_PDF_BYTES) return null;
  return `Com esta arte, cada PDF de produção ficaria com ${formatMegabytes(singlePagePdfBytes)} só de imagem, o que estoura o limite de entrega do servidor (${formatMegabytes(MAX_DELIVERABLE_BYTES)}) assim que o lote passa de poucas placas. Exporte a arte como JPG (qualidade 90) em vez de PNG, ou reduza o tamanho da imagem.`;
}
