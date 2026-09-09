import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { listWebhookEndpoints, createWebhookEndpoint } from "@/services/webhook-endpoint.service";
import { PUBLIC_WEBHOOK_EVENT_TYPES } from "@/domain/api-v1/webhook-events";
import { handleApiError } from "@/lib/api-error";

const createWebhookSchema = z.object({
  url: z.string().url(),
  description: z.string().trim().max(200).optional().nullable(),
  events: z.array(z.enum(PUBLIC_WEBHOOK_EVENT_TYPES as [string, ...string[]])).min(1),
});

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const endpoints = await listWebhookEndpoints(ctx.companyId);
    return NextResponse.json({ endpoints });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const input = createWebhookSchema.parse(await req.json());
    const endpoint = await createWebhookEndpoint(ctx.companyId, input);
    return NextResponse.json({ endpoint }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
