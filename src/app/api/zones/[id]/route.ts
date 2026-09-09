import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { deleteZone, updateZone } from "@/services/zone.service";
import { updateZoneSchema } from "@/lib/validations/zone";
import { publishEvent } from "@/lib/event-bus";
import { handleApiError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const { id } = await params;
    const input = updateZoneSchema.parse(await req.json());
    const zone = await updateZone(ctx.companyId, id, input);
    await publishEvent("ZonaAtualizada", { zoneId: id, action: "UPDATED" }, { companyId: ctx.companyId });
    return NextResponse.json({ zone });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const { id } = await params;
    await deleteZone(ctx.companyId, id);
    await publishEvent("ZonaAtualizada", { zoneId: id, action: "DELETED" }, { companyId: ctx.companyId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
