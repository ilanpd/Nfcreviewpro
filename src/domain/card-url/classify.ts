/**
 * Endereço do cartão (ADR-076). A URL gravada no chip NFC e impressa no QR é
 * permanente: cartão entregue não volta para ser regravado. Por isso o
 * endereço do cartão é uma decisão própria, separada da URL do app, e este
 * módulo (puro, sem `process.env`) decide se ele já pode ser gravado em
 * material físico.
 */

export type CardUrlKind = "final" | "provisional" | "local" | "invalid";

export interface CardUrlStatus {
  kind: CardUrlKind;
  /** Origem normalizada (esquema + host, sem barra final nem caminho). Vazia quando inválida. */
  origin: string;
  host: string;
  /** Frase pronta para o operador (Admin, log de build). */
  message: string;
}

// Hospedagens de preview/túnel: o endereço muda ou some quando o projeto é
// recriado. Nunca podem ir para um chip.
const PROVISIONAL_HOST_SUFFIXES = [
  ".vercel.app",
  ".netlify.app",
  ".pages.dev",
  ".onrender.com",
  ".herokuapp.com",
  ".ngrok.io",
  ".ngrok-free.app",
  ".trycloudflare.com",
];

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".test")
  );
}

/**
 * Escolhe o valor bruto: o endereço do cartão tem prioridade; sem ele, cai na
 * URL do app (comportamento anterior ao ADR-076, para nenhum ambiente
 * existente quebrar); sem nenhum dos dois, o servidor local.
 */
export function resolveCardBaseInput(cardBase: string | undefined, appUrl: string | undefined): string {
  const card = cardBase?.trim();
  if (card) return card;
  const app = appUrl?.trim();
  if (app) return app;
  return "http://localhost:3000";
}

export function classifyCardBaseUrl(raw: string): CardUrlStatus {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return {
      kind: "invalid",
      origin: "",
      host: "",
      message: "O endereço do cartão (NEXT_PUBLIC_CARD_BASE_URL) não é uma URL válida.",
    };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      kind: "invalid",
      origin: "",
      host: "",
      message: "O endereço do cartão precisa começar com https:// (ou http:// só em desenvolvimento).",
    };
  }

  const origin = url.origin;
  const host = url.host;

  if (isLocalHost(url.hostname)) {
    return { kind: "local", origin, host, message: `Endereço local (${host}): serve só para desenvolvimento, nunca para um chip.` };
  }
  if (url.protocol === "http:" || PROVISIONAL_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))) {
    return {
      kind: "provisional",
      origin,
      host,
      message: `Endereço provisório (${host}): um chip gravado com ele quebra se o domínio mudar. Defina o domínio definitivo antes de gravar chips ou imprimir QR.`,
    };
  }
  return { kind: "final", origin, host, message: `Endereço definitivo (${host}).` };
}

/** Bloqueia só quando o ambiente declarou que exige endereço definitivo. */
export function isCardUrlBlocked(kind: CardUrlKind, requireFinal: boolean): boolean {
  return requireFinal && kind !== "final";
}

export function joinCardUrl(origin: string, code: string): string {
  return `${origin}/r/${code}`;
}
