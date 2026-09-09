import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { listApiKeys, createApiKey } from "@/services/api-key.service";
import { API_SCOPES } from "@/domain/api-v1/scopes";
import { handleApiError } from "@/lib/api-error";

const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(60),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  expiresAt: z.coerce.date().optional().nullable(),
});

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const apiKeys = await listApiKeys(ctx.companyId);
    return NextResponse.json({ apiKeys });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const input = createApiKeySchema.parse(await req.json());
    const { apiKey, fullKey } = await createApiKey(ctx.companyId, ctx.userId, input);
    // fullKey só existe nesta resposta — nunca é recuperável depois.
    return NextResponse.json({ apiKey, fullKey }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
