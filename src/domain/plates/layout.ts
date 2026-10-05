/**
 * Estoque de placas (ADR-092) — geometria da arte. Tudo em milímetros, medido
 * a partir do canto superior esquerdo da ÁREA FINAL (já cortada, sem a
 * sangria). A página do PDF é a área final mais a sangria nos quatro lados —
 * é o que a gráfica espera receber.
 */

export const MM_PER_INCH = 25.4;
export const PT_PER_MM = 72 / MM_PER_INCH;

/** Zona de silêncio do QR, em módulos, embutida dentro da caixa do QR. */
export const QR_QUIET_MODULES = 4;

/** Abaixo disto um QR impresso começa a falhar em câmera de celular comum. */
export const MIN_QR_MODULE_MM = 0.5;
/** Abaixo disto a impressão fica visivelmente serrilhada em 10 cm. */
export const RECOMMENDED_MIN_DPI = 250;
export const MIN_QR_SIZE_MM = 15;

export interface PlateLayout {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  qrXMm: number;
  qrYMm: number;
  qrSizeMm: number;
  serialEnabled: boolean;
  serialXMm: number;
  serialYMm: number;
  serialFontPt: number;
}

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

export function pageSizeMm(layout: Pick<PlateLayout, "widthMm" | "heightMm" | "bleedMm">): { width: number; height: number } {
  return { width: layout.widthMm + 2 * layout.bleedMm, height: layout.heightMm + 2 * layout.bleedMm };
}

/** Lado de um módulo (quadradinho) do QR impresso, contando a zona de silêncio. */
export function qrModuleSizeMm(qrSizeMm: number, modules: number): number {
  return qrSizeMm / (modules + 2 * QR_QUIET_MODULES);
}

export function effectiveDpi(pixels: number, mm: number): number {
  return pixels / (mm / MM_PER_INCH);
}

export interface LayoutCheck {
  errors: string[];
  warnings: string[];
}

export interface LayoutContext {
  /** Módulos por lado do QR que será impresso (depende do tamanho da URL). */
  qrModules?: number;
  /** Pixels da arte de fundo enviada, quando houver. */
  background?: { widthPx: number; heightPx: number } | null;
}

/**
 * Erros impedem salvar (o PDF sairia errado); avisos deixam salvar mas
 * aparecem em destaque no editor — são o "isto vai imprimir mal" que ninguém
 * vê até a placa chegar.
 */
export function validateLayout(layout: PlateLayout, context: LayoutContext = {}): LayoutCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(layout.widthMm > 0 && layout.heightMm > 0)) errors.push("A largura e a altura da placa precisam ser maiores que zero.");
  if (layout.widthMm > 1000 || layout.heightMm > 1000) errors.push("Tamanho acima de 1000 mm não é suportado.");
  if (layout.bleedMm < 0 || layout.bleedMm > 20) errors.push("A sangria precisa estar entre 0 e 20 mm.");
  if (layout.qrSizeMm < 10) errors.push("O QR precisa ter pelo menos 10 mm de lado.");

  const qrRight = layout.qrXMm + layout.qrSizeMm;
  const qrBottom = layout.qrYMm + layout.qrSizeMm;
  if (layout.qrXMm < 0 || layout.qrYMm < 0 || qrRight > layout.widthMm || qrBottom > layout.heightMm) {
    errors.push("O QR precisa ficar inteiro dentro da área final da placa (não pode invadir a sangria).");
  }

  if (layout.serialEnabled) {
    if (layout.serialFontPt < 3 || layout.serialFontPt > 40) errors.push("O corpo da série precisa estar entre 3 e 40 pt.");
    if (layout.serialXMm < 0 || layout.serialYMm < 0 || layout.serialXMm > layout.widthMm || layout.serialYMm > layout.heightMm) {
      errors.push("A série precisa começar dentro da área final da placa.");
    }
  }

  if (errors.length === 0) {
    if (layout.qrSizeMm < MIN_QR_SIZE_MM) {
      warnings.push(`O QR está com ${layout.qrSizeMm.toFixed(0)} mm: abaixo de ${MIN_QR_SIZE_MM} mm a leitura no celular fica arriscada.`);
    }
    if (context.qrModules) {
      const moduleMm = qrModuleSizeMm(layout.qrSizeMm, context.qrModules);
      if (moduleMm < MIN_QR_MODULE_MM) {
        warnings.push(
          `Cada quadradinho do QR sai com ${moduleMm.toFixed(2)} mm (mínimo recomendado ${MIN_QR_MODULE_MM} mm). Aumente o QR ou use um endereço mais curto.`
        );
      }
    }
    if (layout.bleedMm < 2) {
      warnings.push("Sangria abaixo de 2 mm: a gráfica pode deixar uma borda branca no corte.");
    }
    if (context.background) {
      const page = pageSizeMm(layout);
      const dpi = Math.min(effectiveDpi(context.background.widthPx, page.width), effectiveDpi(context.background.heightPx, page.height));
      if (dpi < RECOMMENDED_MIN_DPI) {
        warnings.push(
          `A arte tem ~${Math.round(dpi)} dpi neste tamanho (recomendado ${RECOMMENDED_MIN_DPI}+). Exporte uma imagem maior para o texto não ficar serrilhado.`
        );
      }
      const pageRatio = page.width / page.height;
      const imageRatio = context.background.widthPx / context.background.heightPx;
      if (Math.abs(pageRatio - imageRatio) / pageRatio > 0.01) {
        warnings.push(
          `A proporção da arte (${imageRatio.toFixed(2)}) não bate com a da página com sangria (${pageRatio.toFixed(2)}): ela vai ser esticada.`
        );
      }
    }
  }

  return { errors, warnings };
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converte uma caixa em mm (origem no canto superior esquerdo da área final)
 * para pontos do PDF (origem no canto INFERIOR esquerdo da página, que inclui a
 * sangria). É a única conta de coordenadas do módulo — o editor visual e o PDF
 * usam a mesma, para o que se vê na tela ser o que sai impresso.
 */
export function toPdfRect(layout: Pick<PlateLayout, "heightMm" | "bleedMm">, box: { xMm: number; yMm: number; widthMm: number; heightMm: number }): PdfRect {
  return {
    x: mmToPt(layout.bleedMm + box.xMm),
    y: mmToPt(layout.bleedMm + layout.heightMm - box.yMm - box.heightMm),
    width: mmToPt(box.widthMm),
    height: mmToPt(box.heightMm),
  };
}

/** Enquadramento padrão de um modelo novo: QR centralizado na metade inferior. */
export function defaultLayout(): PlateLayout {
  return {
    widthMm: 100,
    heightMm: 100,
    bleedMm: 3,
    qrXMm: 55,
    qrYMm: 50,
    qrSizeMm: 38,
    serialEnabled: true,
    serialXMm: 8,
    serialYMm: 92,
    serialFontPt: 6,
  };
}
