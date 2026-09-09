/**
 * White Label (Fase 10) — matemática de cor pura, sem I/O, usada pelo
 * `BrandProvider`, pelo Theme Studio e pela geração de QR/ativos de
 * impressão. Deliberadamente sem uma biblioteca de cor nova (chroma-js,
 * culori, etc.) — hex/RGB/HSL simples é o bastante para "derivar um tom
 * secundário," "escolher texto preto ou branco," e "checar contraste
 * seguro para um QR code," e este produto já evita dependência nova quando
 * a conta cabe em poucas linhas (mesmo raciocínio do Rule Engine não usar
 * uma lib de datas — ver RELATORIO_FASE_3.md).
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/** Luminância relativa (WCAG 2.x), 0 (preto) a 1 (branco). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razão de contraste WCAG entre duas cores — 1 (idêntico) a 21 (preto/branco). */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Preto ou branco — o que ler melhor sobre `hex`, pelo padrão WCAG AA
 * (contraste ≥ 4.5). Usado para decidir a cor do texto sobre um botão/
 * cabeçalho pintado com a cor da marca. */
export function readableTextColor(hex: string): "#000000" | "#FFFFFF" {
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, "#FFFFFF") ? "#000000" : "#FFFFFF";
}

/** Clareia (`amount` > 0) ou escurece (`amount` < 0) uma cor misturando com
 * branco/preto — mistura linear simples em RGB, suficiente para hover/
 * pressed/tons derivados; não é uma mistura perceptualmente uniforme (LCH),
 * que exigiria uma biblioteca de cor. */
export function mix(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  return rgbToHex({
    r: r + (target - r) * t,
    g: g + (target - g) * t,
    b: b + (target - b) * t,
  });
}

/**
 * Deriva um tom secundário neutro a partir da cor primária, para quando o
 * empresário não escolhe uma segunda cor — nunca uma cor sem relação com a
 * marca. Clareia bastante (85% em direção ao branco) para servir como fundo
 * sutil/estado de hover, mantendo o matiz reconhecível.
 */
export function deriveSecondaryColor(primaryHex: string): string {
  return mix(primaryHex, 0.85);
}

/**
 * QR Code White Label (Fase 10) — um QR só é útil se um leitor de celular
 * conseguir escaneá-lo. Cores de marca claras (ex.: um amarelo ou um rosa
 * pastel) têm contraste baixo demais contra o fundo branco para servir
 * como o módulo "escuro" do QR com segurança. Em vez de usar a cor da
 * marca sem verificar, escurece progressivamente até atingir um contraste
 * seguro (≥ 7:1 contra branco — mais rígido que o AA de texto, porque um
 * leitor de QR é mais sensível a contraste do que um olho humano lendo
 * texto) — nunca inventa uma cor sem relação com a marca original, só a
 * torna segura de escanear.
 */
export function ensureScannableDark(hex: string): string {
  let candidate = hex;
  let guard = 0;
  while (contrastRatio(candidate, "#FFFFFF") < 7 && guard < 10) {
    candidate = mix(candidate, -0.15);
    guard += 1;
  }
  return candidate;
}

export interface BrandColorSet {
  primary: string;
  secondary: string;
  onPrimary: "#000000" | "#FFFFFF";
  hoverPrimary: string;
  pressedPrimary: string;
}

/** O único lugar que decide o conjunto completo de tons derivados de uma
 * cor de marca — usado por `BrandProvider` para preencher variáveis CSS, e
 * pelos exportadores de QR/impressão para saber que cor usar onde. Nunca
 * cada consumidor decidindo sua própria fórmula de "escurecer 12%". */
export function buildBrandColorSet(primaryHex: string, secondaryHex?: string | null): BrandColorSet {
  const primary = isValidHexColor(primaryHex) ? primaryHex : "#0F172A";
  const secondary = secondaryHex && isValidHexColor(secondaryHex) ? secondaryHex : deriveSecondaryColor(primary);
  return {
    primary,
    secondary,
    onPrimary: readableTextColor(primary),
    hoverPrimary: mix(primary, -0.12),
    pressedPrimary: mix(primary, -0.22),
  };
}
