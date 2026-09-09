import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiV1 } from "@/lib/api-v1";
import { listWebhookEndpoints, createWebhookEndpoint } from "@/services/webhook-endpoint.service";
import { PUBLIC_WEBHOOK_EVENT_TYPES } from "@/domain/api-v1/webhook-events";

const createWebhookSchema = z.object({
  url: z.string().url(),
  description: z.string().trim().max(200).optional().nullable(),
  events: z.array(z.enum(PUBLIC_WEBHOOK_EVENT_TYPES as [string, ...string[]])).min(1),
});

/** Não paginado por cursor: o número de endpoints de webhook por empresa é
 * pequeno por natureza (tipicamente 1-5) — ver o mesmo raciocínio em
 * /campaigns/:id/assignments. */
export const GET = withApiV1(
  async (_req, { apiKey }) => {
    const endpoints = await listWebhookEndpoints(apiKey.companyId);
    return NextResponse.json({ data: endpoints });
  },
  { scopes: ["webhooks:manage"] }
);

export const POST = withApiV1(
  async (req, { apiKey }) => {
    const input = createWebhookSchema.parse(await req.json());
    const endpoint = await createWebhookEndpoint(apiKey.companyId, input);
    return NextResponse.json(endpoint, { status: 201 });
  },
  { scopes: ["webhooks:manage"] }
);
