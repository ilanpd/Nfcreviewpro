import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/scrub";

/** Mesma configuração/honestidade de `sentry.server.config.ts`, para o
 * runtime Edge (middleware). Ver ADR-034. */
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
