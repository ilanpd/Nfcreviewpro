import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { createRuleSchema } from "@/lib/validations/rule";
import { createRule, listRules } from "@/services/campaign.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const rules = await listRules(ctx.companyId, id);
    return NextResponse.json({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:write");
    const { id } = await params;
    const input = createRuleSchema.parse(await req.json());
    const rule = await createRule(ctx.companyId, id, input);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
