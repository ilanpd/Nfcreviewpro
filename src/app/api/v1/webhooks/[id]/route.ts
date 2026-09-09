import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiV1, notFoundIfMissing } from "@/lib/api-v1";
import { getWebhookEndpoint, updateWebhookEndpoint, deleteWebhookEndpoint } from "@/services/webhook-endpoint.service";
import { PUBLIC_WEBHOOK_EVENT_TYPES } from "@/domain/api-v1/webhook-events";

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().trim().max(200).optional().nullable(),
  events: z.array(z.enum(PUBLIC_WEBHOOK_EVENT_TYPES as [string, ...string[]])).min(1).optional(),
  active: z.boolean().optional(),
});

export const GET = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    const endpoint = await notFoundIfMissing(() => getWebhookEndpoint(apiKey.companyId, params.id));
    return NextResponse.json(endpoint);
  },
  { scopes: ["webhooks:manage"] }
);

export const PATCH = withApiV1<{ id: string }>(
  async (req, { params, apiKey }) => {
    const input = updateWebhookSchema.parse(await req.json());
    const endpoint = await notFoundIfMissing(() => updateWebhookEndpoint(apiKey.companyId, params.id, input));
    return NextResponse.json(endpoint);
  },
  { scopes: ["webhooks:manage"] }
);

export const DELETE = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    await notFoundIfMissing(() => deleteWebhookEndpoint(apiKey.companyId, params.id));
    return NextResponse.json({ id: params.id, deleted: true });
  },
  { scopes: ["webhooks:manage"] }
);
