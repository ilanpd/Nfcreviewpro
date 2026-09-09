import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCircuitBreaker } from "@/lib/circuit-breaker";
import { log } from "@/lib/observability/logger";
import type { WebhookEndpoint, WebhookDelivery } from "@/generated/prisma/client";

/**
 * Webhooks Enterprise (Fase 9) — a única implementação real de "fazer a
 * chamada HTTP assinada e gravar o resultado", usada tanto pelo worker
 * automático (`lib/workers/processors.ts`) quanto pelo replay manual do
 * Dashboard de Desenvolvedor (`services/webhook-endpoint.service.ts`) —
 * nunca duas cópias da mesma lógica que poderiam divergir sobre o que
 * conta como sucesso. Ver ADR-036.
 */
async function signPayload(secret: string, payload: string): Promise<string> {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function attemptWebhookDelivery(
  endpoint: WebhookEndpoint,
  delivery: WebhookDelivery,
  options: { isLastAttempt: boolean; onChaos?: () => Promise<void> }
): Promise<void> {
  const body = JSON.stringify({ ...(delivery.payload as object), type: delivery.eventType });
  const breaker = getCircuitBreaker(`webhook:${endpoint.id}`);

  try {
    const responseCode = await breaker.execute(async () => {
      await options.onChaos?.();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-NFC-OS-Signature": await signPayload(endpoint.secret, body),
        "X-NFC-OS-Event": delivery.eventType,
      };
      const res = await fetch(endpoint.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Webhook respondeu ${res.status}`);
      return res.status;
    });

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "SUCCESS", attempts: { increment: 1 }, responseCode, lastAttemptAt: new Date(), errorMessage: null },
    });
    log.info("webhooks", `Webhook entregue: ${delivery.eventType}`, { eventId: delivery.eventId, endpointId: endpoint.id });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: options.isLastAttempt ? "EXHAUSTED" : "FAILED",
        attempts: { increment: 1 },
        errorMessage,
        lastAttemptAt: new Date(),
      },
    });
    throw err;
  }
}
