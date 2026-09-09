import "server-only";

/**
 * Observability Engine (Fase 8) — OpenTelemetry, de verdade (spans reais,
 * SDK real), mas honesto sobre o que existe neste ambiente: **nenhum
 * coletor OTel está configurado neste sandbox** (nem Honeycomb, nem Grafana
 * Cloud, nem um Jaeger self-hosted) — a mesma postura de detecção honesta
 * já usada para MCPs de design na Fase 4.5 ("nenhum conector detectado,
 * documentado, não fingido"). Por padrão os spans vão para um
 * `ConsoleSpanExporter` (aparecem no log do processo Node), o suficiente
 * para provar que o rastreamento está funcionando de ponta a ponta sem
 * exigir uma conta em nenhum serviço externo para este produto rodar.
 *
 * Para conectar um coletor real depois, troque `ConsoleSpanExporter` por um
 * `OTLPTraceExporter` (já disponível como dependência transitiva do SDK,
 * em `@opentelemetry/exporter-trace-otlp-http`) apontando para a URL do
 * coletor via `OTEL_EXPORTER_OTLP_ENDPOINT` — a troca é uma linha neste
 * arquivo, não uma migração. Ver ADR-034.
 */
let sdkStarted = false;

export async function startTracing() {
  if (sdkStarted) return;
  sdkStarted = true;

  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { ConsoleSpanExporter, SimpleSpanProcessor } = await import("@opentelemetry/sdk-trace-node");
    const { resourceFromAttributes } = await import("@opentelemetry/resources");
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import("@opentelemetry/semantic-conventions");

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: "nfc-review-pro",
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
      }),
      spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    });

    sdk.start();
    console.log(JSON.stringify({ level: "info", module: "tracing", message: "OpenTelemetry SDK iniciado (exportador: console — nenhum coletor configurado)" }));
  } catch (err) {
    console.error("[tracing] falha ao iniciar OpenTelemetry — o app continua funcionando sem rastreamento", err);
  }
}

/** Cria um span real ao redor de `fn` — usado no caminho crítico do
 * Resolution Engine e no Event Bus. Nunca lança por conta própria: uma
 * falha do próprio OpenTelemetry (ex.: SDK não iniciado) não pode derrubar
 * o código que ele está só observando. */
export async function withSpan<T>(name: string, fn: () => Promise<T>, attributes?: Record<string, string | number | boolean>): Promise<T> {
  try {
    const { recordSpanStarted } = await import("./trace-metrics");
    recordSpanStarted();
    const { trace } = await import("@opentelemetry/api");
    const tracer = trace.getTracer("nfc-review-pro");
    return await tracer.startActiveSpan(name, async (span) => {
      try {
        if (attributes) span.setAttributes(attributes);
        return await fn();
      } catch (err) {
        span.recordException(err as Error);
        throw err;
      } finally {
        span.end();
      }
    });
  } catch {
    return fn();
  }
}
