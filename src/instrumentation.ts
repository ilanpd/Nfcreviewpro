/**
 * Observability Engine (Fase 8) — ponto de entrada oficial do Next.js para
 * inicializar instrumentação (OpenTelemetry + Sentry) uma única vez, quando
 * o servidor sobe. `instrumentation.ts` também é carregado no runtime Edge
 * (middleware) — o SDK do OpenTelemetry usa APIs do Node (`async_hooks`,
 * etc.) que não existem lá, então esse import só acontece quando
 * `NEXT_RUNTIME === "nodejs"`; o Sentry tem uma config dedicada para cada
 * runtime (`sentry.server.config.ts`/`sentry.edge.config.ts`), ambas
 * no-op sem `NEXT_PUBLIC_SENTRY_DSN` — ver ADR-034.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startTracing } = await import("@/lib/observability/tracing");
    await startTracing();
    await import("./sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  ...args: Parameters<NonNullable<import("next").Instrumentation.onRequestError>>
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  await Sentry.captureRequestError(...args);
}
