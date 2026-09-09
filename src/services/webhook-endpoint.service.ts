import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth";
import { attemptWebhookDelivery } from "@/lib/webhooks/delivery";
import { PUBLIC_WEBHOOK_EVENT_TYPES } from "@/domain/api-v1/webhook-events";

/**
 * Webhooks Enterprise (Fase 9) — CRUD de `WebhookEndpoint`, usado tanto pela
 * API pública v1 (`/api/v1/webhooks`) quanto pelo Dashboard de
 * Desenvolvedor. Substitui o par único `Company.webhookUrl`/`webhookSecret`
 * da Fase 8 — ver ADR-036 para a migração e o porquê.
 */
function assertValidEvents(events: string[]) {
  const invalid = events.filter((e) => !PUBLIC_WEBHOOK_EVENT_TYPES.includes(e));
  if (invalid.length > 0) throw new ForbiddenError(`Evento(s) inválido(s): ${invalid.join(", ")}`);
}

export function listWebhookEndpoints(companyId: string) {
  return prisma.webhookEndpoint.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
}

export async function getWebhookEndpoint(companyId: string, id: string) {
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id, companyId } });
  if (!endpoint) throw new ForbiddenError("Endpoint de webhook não encontrado nesta empresa");
  return endpoint;
}

export async function createWebhookEndpoint(
  companyId: string,
  input: { url: string; description?: string | null; events: string[] }
) {
  assertValidEvents(input.events);
  if (input.events.length === 0) throw new ForbiddenError("Selecione ao menos um evento para o webhook");

  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  return prisma.webhookEndpoint.create({
    data: { companyId, url: input.url, description: input.description ?? null, events: input.events, secret },
  });
}

export async function updateWebhookEndpoint(
  companyId: string,
  id: string,
  input: { url?: string; description?: string | null; events?: string[]; active?: boolean }
) {
  await getWebhookEndpoint(companyId, id);
  if (input.events) assertValidEvents(input.events);

  return prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.events !== undefined ? { events: input.events } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

export async function deleteWebhookEndpoint(companyId: string, id: string) {
  await getWebhookEndpoint(companyId, id);
  await prisma.webhookEndpoint.delete({ where: { id } });
}

export async function listWebhookDeliveries(companyId: string, endpointId: string, cursor?: string, limit = 20) {
  await getWebhookEndpoint(companyId, endpointId);
  return prisma.webhookDelivery.findMany({
    where: { endpointId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

/** Reenvia uma entrega específica manualmente, de verdade — chama a mesma
 * função de entrega do worker automático (`lib/webhooks/delivery.ts`),
 * síncrono com a resposta desta chamada, não apenas resetando um status e
 * esperando a fila pegar depois. Uma falha no reenvio nunca lança daqui —
 * `attemptWebhookDelivery` já grava o resultado (FAILED) na própria linha;
 * o chamador vê o resultado real no retorno, nunca um 500 genérico por uma
 * falha esperada de rede do lado do cliente. */
export async function replayWebhookDelivery(companyId: string, endpointId: string, deliveryId: string) {
  const endpoint = await getWebhookEndpoint(companyId, endpointId);
  const delivery = await prisma.webhookDelivery.findFirst({ where: { id: deliveryId, endpointId: endpoint.id } });
  if (!delivery) throw new ForbiddenError("Entrega não encontrada para este endpoint");

  try {
    await attemptWebhookDelivery(endpoint, delivery, { isLastAttempt: false });
  } catch {
    // já registrado como FAILED por attemptWebhookDelivery — ver o retorno abaixo
  }
  return prisma.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
}
