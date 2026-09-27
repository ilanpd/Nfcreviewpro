import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission, requirePlanFeature } from "@/lib/auth";
import { voidInputSchema } from "@/lib/validations/return-offer";
import { voidVoucher } from "@/services/return-offer.service";
import { handleApiError } from "@/lib/api-error";

/** Anula um brinde (resgate por engano, fraude). Exige motivo e fica na auditoria. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "return:manage");
    requirePlanFeature(ctx, "return_offer");
    const { id } = await params;
    const { reason } = voidInputSchema.parse(await req.json());
    await voidVoucher(ctx, id, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
