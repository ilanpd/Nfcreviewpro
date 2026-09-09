import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { createVariantSchema } from "@/lib/validations/rule";
import { createVariant, listVariants } from "@/services/campaign.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const variants = await listVariants(ctx.companyId, id);
    return NextResponse.json({ variants });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:write");
    const { id } = await params;
    const input = createVariantSchema.parse(await req.json());
    const variant = await createVariant(ctx.companyId, id, input);
    return NextResponse.json({ variant }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
