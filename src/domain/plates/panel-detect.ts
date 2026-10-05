/**
 * Estoque de placas (ADR-092) — achar, na própria arte, o painel branco onde o QR
 * vai entrar, e calcular o QR que cabe nele. Função pura: recebe os pixels já
 * lidos (o editor desenha a arte num canvas e entrega o `ImageData`), nunca
 * toca imagem, rede ou tela.
 *
 * Por que existe: depois de enviar a arte, o QR de exemplo cai no lugar padrão do
 * modelo e quase nunca coincide com o painel. Em vez de a pessoa tentar acertar
 * milímetros digitando, um clique enquadra o QR dentro do painel.
 */

export interface PixelImage {
  /** RGBA, 4 bytes por pixel (o formato de `ImageData.data`). */
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/** Caixa em pixels, com os dois extremos INCLUSIVOS. */
export interface PanelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface DetectOptions {
  /** Canal mínimo (0–255) para um pixel contar como "branco chapado". */
  threshold?: number;
}

const MIN_AREA_RATIO = 0.004; // o painel tem de ser ao menos 0,4% da arte (descarta letras e pontos)
const MIN_FILL_RATIO = 0.5; // e estar realmente preenchido (descarta anéis e molduras)
const MAX_ASPECT = 2; // e ser mais ou menos quadrado

/**
 * O maior bloco branco CONECTADO e preenchido que não encosta na borda da
 * imagem. Letras brancas são pequenas; uma moldura branca é um anel (pouco
 * preenchida); o branco que encosta na borda é fundo da arte, não painel.
 */
export function detectWhitePanel(image: PixelImage, options: DetectOptions = {}): PanelBox | null {
  const { width, height, data } = image;
  const threshold = options.threshold ?? 240;
  if (width < 8 || height < 8 || data.length < width * height * 4) return null;

  const isWhite = (index: number) => {
    const i = index * 4;
    return data[i + 3] >= 200 && data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold;
  };

  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let best: (PanelBox & { area: number }) | null = null;

  for (let start = 0; start < width * height; start++) {
    if (seen[start] || !isWhite(start)) continue;

    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let x0 = width, y0 = height, x1 = 0, y1 = 0, area = 0;
    let touchesBorder = false;

    while (top > 0) {
      const current = stack[--top];
      const x = current % width;
      const y = (current - x) / width;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;

      if (x > 0) push(current - 1);
      if (x < width - 1) push(current + 1);
      if (y > 0) push(current - width);
      if (y < height - 1) push(current + width);
    }

    function push(next: number) {
      if (seen[next] || !isWhite(next)) return;
      seen[next] = 1;
      stack[top++] = next;
    }

    if (touchesBorder) continue;
    const boxW = x1 - x0 + 1;
    const boxH = y1 - y0 + 1;
    if (area < width * height * MIN_AREA_RATIO) continue;
    if (area / (boxW * boxH) < MIN_FILL_RATIO) continue;
    const aspect = boxW / boxH;
    if (aspect > MAX_ASPECT || aspect < 1 / MAX_ASPECT) continue;
    if (!best || area > best.area) best = { x0, y0, x1, y1, area };
  }

  return best ? { x0: best.x0, y0: best.y0, x1: best.x1, y1: best.y1 } : null;
}

export interface QrFit {
  qrXMm: number;
  qrYMm: number;
  qrSizeMm: number;
}

const half = (v: number) => Math.round(v * 2) / 2;
const halfDown = (v: number) => Math.floor(v * 2) / 2;

/**
 * O QR quadrado que cabe no painel, centralizado, com uma folga de `margin`
 * (fração do lado do painel, de cada lado). A imagem cobre a página inteira
 * (área final + sangria), esticada — a mesma regra do PDF —, então pixels viram
 * milímetros pela proporção da página, e a sangria é descontada para a medida
 * ficar a partir do canto do CORTE, que é o que o editor usa.
 *
 * `null` quando o painel é pequeno demais para um QR legível (menos de 10 mm).
 */
export function fitQrIntoPanel(
  panel: PanelBox,
  image: { width: number; height: number },
  layout: { widthMm: number; heightMm: number; bleedMm: number },
  margin = 0.04
): QrFit | null {
  const pageW = layout.widthMm + 2 * layout.bleedMm;
  const pageH = layout.heightMm + 2 * layout.bleedMm;
  const mmPerPxX = pageW / image.width;
  const mmPerPxY = pageH / image.height;

  const left = panel.x0 * mmPerPxX - layout.bleedMm;
  const right = (panel.x1 + 1) * mmPerPxX - layout.bleedMm;
  const top = panel.y0 * mmPerPxY - layout.bleedMm;
  const bottom = (panel.y1 + 1) * mmPerPxY - layout.bleedMm;

  const side = halfDown(Math.min(right - left, bottom - top) * (1 - 2 * margin));
  if (side < 10) return null;

  const x = half((left + right) / 2 - side / 2);
  const y = half((top + bottom) / 2 - side / 2);
  return {
    qrSizeMm: side,
    qrXMm: Math.min(Math.max(0, x), Math.max(0, layout.widthMm - side)),
    qrYMm: Math.min(Math.max(0, y), Math.max(0, layout.heightMm - side)),
  };
}
