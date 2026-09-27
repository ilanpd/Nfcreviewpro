import QRCode from "qrcode";
import { ensureScannableDark } from "@/domain/white-label/color";

// QR padrão do cartão (ADR-076): gerado sob demanda por /api/qr/[code], nunca
// guardado no banco. Um PNG em data URL pesa ~8 KB por cartão e amarra o QR ao
// domínio de quando foi criado; gerar na hora custa alguns milissegundos.
const DEFAULT_QR_COLORS = { dark: "#0F172A", light: "#FFFFFF" };

export async function generateQrPngBuffer(targetUrl: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(targetUrl, { type: "png", margin: 2, width: size, color: DEFAULT_QR_COLORS });
}

export async function generateQrSvg(targetUrl: string, size = 512): Promise<string> {
  return QRCode.toString(targetUrl, { type: "svg", margin: 2, width: size, color: DEFAULT_QR_COLORS });
}

export interface BrandedQrOptions {
  /** Cor "escura" pedida (normalmente `colors.primary` da marca) — passada
   * por `ensureScannableDark` antes de qualquer geração, nunca usada crua. */
  darkColor: string;
  /** Fundo — quase sempre branco continua sendo o mais seguro para
   * escaneamento; aceito como parâmetro para o Theme Studio poder mostrar
   * "e se eu usar minha cor secundária de fundo" no preview, mas o próprio
   * Theme Studio avisa quando o contraste resultante fica arriscado. */
  lightColor?: string;
  /** Pixels de lado da imagem quadrada (PNG/SVG). */
  size?: number;
}

/**
 * QR Code White Label (Fase 10) — a mesma geração de sempre, mas com as
 * cores da marca em vez do preto/branco fixo do MVP, e com uma checagem
 * real de contraste (`ensureScannableDark`) antes de aceitar a cor pedida
 * — nunca gera um QR bonito e ilegível. Ver ADR-044.
 */
export async function generateBrandedQrPngDataUrl(targetUrl: string, options: BrandedQrOptions): Promise<string> {
  const dark = ensureScannableDark(options.darkColor);
  return QRCode.toDataURL(targetUrl, {
    margin: 2,
    width: options.size ?? 1024,
    color: { dark, light: options.lightColor ?? "#FFFFFF" },
  });
}

export async function generateBrandedQrSvg(targetUrl: string, options: BrandedQrOptions): Promise<string> {
  const dark = ensureScannableDark(options.darkColor);
  return QRCode.toString(targetUrl, {
    type: "svg",
    margin: 2,
    width: options.size ?? 1024,
    color: { dark, light: options.lightColor ?? "#FFFFFF" },
  });
}
