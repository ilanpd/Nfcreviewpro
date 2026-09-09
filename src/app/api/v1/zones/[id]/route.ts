import { NextResponse } from "next/server";
import { withApiV1, notFoundIfMissing } from "@/lib/api-v1";
import { getZone, updateZone, deleteZone } from "@/services/zone.service";
import { updateZoneSchema } from "@/lib/validations/zone";

export const GET = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    const zone = await notFoundIfMissing(() => getZone(apiKey.companyId, params.id));
    return NextResponse.json(zone);
  },
  { scopes: ["zones:read"] }
);

export const PATCH = withApiV1<{ id: string }>(
  async (req, { params, apiKey }) => {
    const input = updateZoneSchema.parse(await req.json());
    const zone = await notFoundIfMissing(() => updateZone(apiKey.companyId, params.id, input));
    return NextResponse.json(zone);
  },
  { scopes: ["zones:write"] }
);

export const DELETE = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    await notFoundIfMissing(() => deleteZone(apiKey.companyId, params.id));
    return NextResponse.json({ id: params.id, deleted: true });
  },
  { scopes: ["zones:write"] }
);
