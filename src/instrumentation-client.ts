import * as Sentry from "@sentry/nextjs";

/** Inicialização do Sentry no cliente — mesma honestidade/gate de
 * `sentry.server.config.ts` (no-op sem `NEXT_PUBLIC_SENTRY_DSN`). Ver ADR-034. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
