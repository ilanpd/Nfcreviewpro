import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { createZone, listZones } from "@/services/zone.service";
import { createZoneSchema } from "@/lib/validations/zone";
import { publishEvent } from "@/lib/event-bus";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const zones = await listZones(ctx.companyId);
    return NextResponse.json({ zones });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const { name, branchId } = createZoneSchema.parse(await req.json());
    const zone = await createZone(ctx.companyId, name, branchId);
    await publishEvent("ZonaAtualizada", { zoneId: zone.id, action: "CREATED" }, { companyId: ctx.companyId });
    return NextResponse.json({ zone }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
