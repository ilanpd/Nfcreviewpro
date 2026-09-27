import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission, requirePlanFeature } from "@/lib/auth";
import { offerInputSchema } from "@/lib/validations/return-offer";
import { getOfferSettings, saveOffer } from "@/services/return-offer.service";
import { handleApiError } from "@/lib/api-error";

/** Configuração do brinde de retorno da empresa (ADR-079). Nunca devolve o hash do PIN. */
export async function GET() {
  try {
    const ctx = await requireAuthContext();
    requirePlanFeature(ctx, "return_offer");
    return NextResponse.json(await getOfferSettings(ctx.companyId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "return:manage");
    requirePlanFeature(ctx, "return_offer");
    const input = offerInputSchema.parse(await req.json());
    await saveOffer(ctx, input);
    return NextResponse.json(await getOfferSettings(ctx.companyId));
  } catch (error) {
    return handleApiError(error);
  }
}
