import {
  classifyCardBaseUrl,
  isCardUrlBlocked,
  joinCardUrl,
  resolveCardBaseInput,
  type CardUrlKind,
  type CardUrlStatus,
} from "@/domain/card-url/classify";

/**
 * Endereço do cartão (ADR-076). Seguro para o navegador: só lê variáveis
 * `NEXT_PUBLIC_*`, que o Next.js embute no bundle. O acesso precisa ser o
 * literal `process.env.NEXT_PUBLIC_X` — ler por chave dinâmica não é embutido.
 */
export function getCardUrlStatus(): CardUrlStatus {
  return classifyCardBaseUrl(resolveCardBaseInput(process.env.NEXT_PUBLIC_CARD_BASE_URL, process.env.NEXT_PUBLIC_APP_URL));
}

/** Endereço público que vai no chip e no QR: `<origem>/r/<código>`. */
export function cardPublicUrl(code: string): string {
  const status = getCardUrlStatus();
  return joinCardUrl(status.origin || "http://localhost:3000", code);
}

export interface CardQrOptions {
  size?: 128 | 256 | 512 | 1024;
  format?: "png" | "svg";
  download?: boolean;
}

/** Caminho relativo da imagem do QR, gerada sob demanda (nada é guardado no banco). */
export function cardQrPath(code: string, options: CardQrOptions = {}): string {
  const params = new URLSearchParams();
  if (options.size) params.set("size", String(options.size));
  if (options.format) params.set("format", options.format);
  if (options.download) params.set("download", "1");
  const query = params.toString();
  return `/api/qr/${encodeURIComponent(code)}${query ? `?${query}` : ""}`;
}

export interface CardUrlGuard {
  status: CardUrlStatus;
  blocked: boolean;
  /** Preenchida só quando `blocked`. */
  message: string | null;
}

/**
 * Só no servidor: `CARD_URL_REQUIRE_FINAL` não é `NEXT_PUBLIC_*`. Com `=1`, o
 * ambiente declara que aceita gravar chip e imprimir QR só com domínio
 * definitivo — usado em produção antes do primeiro lote de cartões.
 */
export function getCardUrlGuard(): CardUrlGuard {
  const status = getCardUrlStatus();
  const blocked = isCardUrlBlocked(status.kind, process.env.CARD_URL_REQUIRE_FINAL === "1");
  return { status, blocked, message: blocked ? status.message : null };
}

export class CardUrlNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardUrlNotReadyError";
  }
}

export function assertCardUrlReady(): void {
  const guard = getCardUrlGuard();
  if (guard.blocked) throw new CardUrlNotReadyError(guard.message ?? "Endereço do cartão não está pronto.");
}

export type { CardUrlKind, CardUrlStatus };
