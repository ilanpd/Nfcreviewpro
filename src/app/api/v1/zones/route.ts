import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiV1, parsePageParams, cursorQueryArgs, buildPage } from "@/lib/api-v1";
import { createZone } from "@/services/zone.service";
import { createZoneSchema } from "@/lib/validations/zone";

export const GET = withApiV1(
  async (req, { apiKey }) => {
    const page = parsePageParams(req.nextUrl.searchParams);
    const rows = await prisma.zone.findMany({
      where: { companyId: apiKey.companyId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorQueryArgs(page),
    });
    return NextResponse.json(buildPage(rows, page.limit));
  },
  { scopes: ["zones:read"] }
);

export const POST = withApiV1(
  async (req, { apiKey }) => {
    const { name, branchId } = createZoneSchema.parse(await req.json());
    const zone = await createZone(apiKey.companyId, name, branchId);
    return NextResponse.json(zone, { status: 201 });
  },
  { scopes: ["zones:write"] }
);
