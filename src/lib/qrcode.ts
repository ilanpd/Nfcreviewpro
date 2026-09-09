import QRCode from "qrcode";
import { ensureScannableDark } from "@/domain/white-label/color";

/** Generates a PNG QR code as a data URL, ready to store or drop into an <img src>. */
export async function generateQrCodeDataUrl(targetUrl: string): Promise<string> {
  return QRCode.toDataURL(targetUrl, {
    margin: 2,
    width: 512,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
}

export function cardPublicUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/r/${code}`;
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
