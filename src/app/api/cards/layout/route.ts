import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { bulkUpdateCardLayoutSchema } from "@/lib/validations/card";
import { bulkUpdateCardLayout } from "@/services/card.service";
import { handleApiError } from "@/lib/api-error";

/** Multi-select drag: one request moving up to 500 tables at once, instead
 * of one PATCH per table (see card.service.ts's bulkUpdateCardLayout). */
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "card:write");
    const input = bulkUpdateCardLayoutSchema.parse(await req.json());
    await bulkUpdateCardLayout(ctx.companyId, input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
