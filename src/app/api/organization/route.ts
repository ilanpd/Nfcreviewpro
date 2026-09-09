import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { createOrganizationSchema, renameOrganizationSchema } from "@/lib/validations/organization";
import { createOrganization, getOrganization, renameOrganization } from "@/services/organization.service";
import { recordAudit } from "@/services/audit.service";
import { publishEvent } from "@/lib/event-bus";
import { handleApiError } from "@/lib/api-error";
import { ForbiddenError } from "@/lib/auth";

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    if (!ctx.organizationId) return NextResponse.json({ organization: null });
    const organization = await getOrganization(ctx.organizationId);
    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "organization:write");
    const { name } = createOrganizationSchema.parse(await req.json());
    const organization = await createOrganization(ctx.companyId, name);
    await recordAudit(ctx, "ORGANIZATION_CREATED", { targetId: organization.id, metadata: { name } });
    await publishEvent("OrganizacaoAtualizada", { organizationId: organization.id, action: "CREATED" }, { organizationId: organization.id, companyId: ctx.companyId });
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "organization:write");
    if (!ctx.organizationId) throw new ForbiddenError("Esta empresa não pertence a uma organização");
    const { name } = renameOrganizationSchema.parse(await req.json());
    const organization = await renameOrganization(ctx.organizationId, name);
    await publishEvent("OrganizacaoAtualizada", { organizationId: organization.id, action: "UPDATED" }, { organizationId: organization.id, companyId: ctx.companyId });
    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error);
  }
}
