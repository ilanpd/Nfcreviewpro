import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { scrubExtra } from "@/lib/observability/scrub";

/**
 * Ponto único para mandar um erro INESPERADO ao Sentry (o que vira 500, ou uma
 * falha que o código só registra e segue, como o webhook do Stripe).
 *
 * Sem `NEXT_PUBLIC_SENTRY_DSN` tudo aqui é no-op: nenhuma chamada de rede, nada
 * "ligado fingindo funcionar" (mesma regra de `sentry.server.config.ts`, ADR-034).
 *
 * Em serverless a função congela logo depois de responder e um evento ainda
 * não enviado se perde. Por isso, depois de capturar, pedimos o envio com
 * `after()` (roda depois da resposta, com a função ainda viva); fora de uma
 * requisição (worker, script) cai no `flush` direto.
 *
 * Privacidade: só vão ids e o módulo de origem; nunca corpo de requisição nem
 * dados do cliente (o `sendDefaultPii` do SDK fica desligado).
 */
export function sentryConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SENTRY_DSN;
}

function flushSoon() {
  try {
    after(() => Sentry.flush(2000));
  } catch {
    void Sentry.flush(2000);
  }
}

export interface ReportContext {
  /** De onde veio (ex.: "api", "stripe-webhook"): vira etiqueta para filtrar no Sentry. */
  module?: string;
  /** Ids e números úteis para achar o caso (nunca dados pessoais). */
  extra?: Record<string, unknown>;
}

export function reportServerError(error: unknown, context: ReportContext = {}): boolean {
  if (!sentryConfigured()) return false;
  Sentry.withScope((scope) => {
    if (context.module) scope.setTag("module", context.module);
    if (context.extra) scope.setExtras(scrubExtra(context.extra) as Record<string, unknown>);
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
  flushSoon();
  return true;
}

export function reportServerMessage(message: string, context: ReportContext = {}): boolean {
  if (!sentryConfigured()) return false;
  Sentry.captureMessage(message, {
    level: "error",
    tags: context.module ? { module: context.module } : undefined,
    extra: context.extra ? (scrubExtra(context.extra) as Record<string, unknown>) : undefined,
  });
  flushSoon();
  return true;
}
