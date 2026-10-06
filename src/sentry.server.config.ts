import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/scrub";

/**
 * Observability Engine (Fase 8) — Sentry preparado, com a mesma honestidade
 * do OpenTelemetry (`lib/observability/tracing.ts`): nenhum projeto Sentry
 * real está configurado neste sandbox. `Sentry.init` só roda quando
 * `NEXT_PUBLIC_SENTRY_DSN` existir — sem DSN, este arquivo é um no-op
 * completo (nenhuma chamada de rede, nenhum SDK "ligado fingindo
 * funcionar"). O DSN usa o prefixo `NEXT_PUBLIC_` porque, ao contrário de um
 * token de autenticação, um DSN do Sentry é seguro para expor no cliente por
 * design — reaproveitar a mesma variável no servidor evita uma segunda env
 * var redundante. Ver ADR-034.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Produção, preview e desenvolvimento separados no Sentry (VERCEL_ENV só existe na Vercel).
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // LGPD: nada de e-mail, CPF/CNPJ, telefone, corpo de requisição ou usuário vai para o Sentry.
    sendDefaultPii: false,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (b) => scrubSentryEvent({ breadcrumbs: [b] }).breadcrumbs?.[0] ?? null,
  });
}
