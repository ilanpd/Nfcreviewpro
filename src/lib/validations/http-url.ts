import { z } from "zod";

/**
 * `z.string().url()` só confere que o texto parseia como URL — `javascript:`,
 * `data:` e `file:` passam. Todo link que depois vira redirecionamento de um
 * cartão físico ou `href` numa tela pública (Google, destino do cartão, logo)
 * tem que ser http(s): o cartão é tocado por desconhecidos, então o destino
 * nunca pode ser um esquema executável. Um lugar só pra regra — o Retorno
 * (`return-offer.ts`) já usava uma cópia local.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** String aparada, com no máximo `max` caracteres, que precisa ser http(s). */
export function httpUrlSchema(message = "Informe um link válido (ex: https://...)", max = 2000) {
  return z.string().trim().max(max).refine(isHttpUrl, message);
}
