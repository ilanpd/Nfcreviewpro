import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { updateWebhookEndpoint, deleteWebhookEndpoint } from "@/services/webhook-endpoint.service";
import { PUBLIC_WEBHOOK_EVENT_TYPES } from "@/domain/api-v1/webhook-events";
import { handleApiError } from "@/lib/api-error";

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().trim().max(200).optional().nullable(),
  events: z.array(z.enum(PUBLIC_WEBHOOK_EVENT_TYPES as [string, ...string[]])).min(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const { id } = await params;
    const input = updateWebhookSchema.parse(await req.json());
    const endpoint = await updateWebhookEndpoint(ctx.companyId, id, input);
    return NextResponse.json({ endpoint });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const { id } = await params;
    await deleteWebhookEndpoint(ctx.companyId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
