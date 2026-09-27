import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext, requirePlanFeature } from "@/lib/auth";
import { getReturnSummary } from "@/services/return-offer.service";
import { handleApiError } from "@/lib/api-error";

const querySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

/** Os três números do painel do Starter: toques, brindes emitidos, clientes que voltaram e resgataram. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePlanFeature(ctx, "return_offer");
    const { days } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json(await getReturnSummary(ctx.companyId, days));
  } catch (error) {
    return handleApiError(error);
  }
}
