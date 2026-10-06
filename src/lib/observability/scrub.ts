/**
 * Filtro de dados pessoais para tudo que sai para o Sentry (LGPD).
 *
 * O Sentry guarda o que recebe em servidores de terceiros. Um erro de envio de
 * e-mail registra o destinatário; uma exceção do banco pode carregar um valor; o
 * "rastro" de console (breadcrumbs) repete as linhas de log. Nada disso pode
 * levar e-mail, CPF/CNPJ, telefone ou nome de cliente. Aqui ficam as regras, puras
 * e testáveis, usadas por `beforeSend` nas três configurações (servidor, edge e
 * cliente) e pelos helpers de `report-error.ts`.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// CPF 000.000.000-00 e CNPJ 00.000.000/0000-00 (com ou sem pontuação)
const DOCUMENT = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
// telefone brasileiro: (11) 98765-4321, 11987654321, +55 11 98765-4321
const PHONE = /(?:\+?55\s?)?\(?\b\d{2}\)?\s?9\d{4}-?\d{4}\b/g;

export function maskPii(text: string): string {
  return text.replace(EMAIL, "[e-mail]").replace(DOCUMENT, "[documento]").replace(PHONE, "[telefone]");
}

const SENSITIVE_KEY =
  /^(to|from|email|e-?mail|phone|telefone|whatsapp|cpf|cnpj|document|customerdocument|customerphone|customeremail|name|nome|customername|address|endereco|shippingaddress|billingaddress|token|secret|password|senha|authorization|cookie|cookies|subject)$/i;

/** Remove as chaves sensíveis (em qualquer profundidade) e mascara texto solto. */
export function scrubExtra(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return maskPii(value);
  if (value === null || typeof value !== "object") return value;
  if (depth > 6) return "[profundo demais]";
  if (Array.isArray(value)) return value.map((v) => scrubExtra(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue;
    out[key] = scrubExtra(v, depth + 1);
  }
  return out;
}

interface EventLike {
  message?: string;
  exception?: { values?: { value?: string }[] };
  extra?: Record<string, unknown>;
  request?: { data?: unknown; cookies?: unknown; query_string?: unknown; headers?: Record<string, string> };
  user?: unknown;
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
}

/** Para `beforeSend`: devolve o mesmo evento, sem dado pessoal. */
export function scrubSentryEvent<E extends EventLike>(event: E): E {
  if (event.message) event.message = maskPii(event.message);
  for (const v of event.exception?.values ?? []) {
    if (v.value) v.value = maskPii(v.value);
  }
  if (event.extra) event.extra = scrubExtra(event.extra) as Record<string, unknown>;
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = maskPii(b.message);
    if (b.data) b.data = scrubExtra(b.data) as Record<string, unknown>;
  }
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/^(cookie|authorization|x-api-key|x-forwarded-for)$/i.test(h)) delete event.request.headers[h];
      }
    }
  }
  delete event.user;
  return event;
}
