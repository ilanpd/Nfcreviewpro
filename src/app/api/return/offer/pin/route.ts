import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission, requirePlanFeature } from "@/lib/auth";
import { pinInputSchema } from "@/lib/validations/return-offer";
import { changePin } from "@/services/return-offer.service";
import { handleApiError } from "@/lib/api-error";

/** Define ou troca o PIN da loja. O valor só existe nesta requisição: vira hash e nunca é devolvido nem registrado. */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "return:manage");
    requirePlanFeature(ctx, "return_offer");
    const { pin } = pinInputSchema.parse(await req.json());
    await changePin(ctx, pin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
