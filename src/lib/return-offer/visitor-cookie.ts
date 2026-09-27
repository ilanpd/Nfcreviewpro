import { randomBytes } from "node:crypto";

/**
 * Cookie `pv` (ADR-079): um identificador aleatório do aparelho, definido pelo
 * servidor, que só serve de atalho para reconhecer o celular na volta. Quem dá
 * direito ao brinde é o código, nunca o cookie. Só é criado quando a empresa
 * tem o Retorno de pé: um cartão sem brinde não deixa marca nenhuma no celular.
 */
export const VISITOR_COOKIE = "pv";
export const VISITOR_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function newVisitorId(): string {
  return randomBytes(16).toString("base64url");
}

/** Um valor de cookie só é aceito se tiver exatamente o formato que nós geramos. */
export function parseVisitorId(value: string | undefined | null): string | null {
  return value && VISITOR_ID_PATTERN.test(value) ? value : null;
}
