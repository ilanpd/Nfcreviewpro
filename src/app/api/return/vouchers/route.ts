import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePlanFeature } from "@/lib/auth";
import { voucherListQuerySchema } from "@/lib/validations/return-offer";
import { listVouchers } from "@/services/return-offer.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePlanFeature(ctx, "return_offer");
    const query = voucherListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json({ vouchers: await listVouchers(ctx.companyId, query) });
  } catch (error) {
    return handleApiError(error);
  }
}
