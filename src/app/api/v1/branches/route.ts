import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiV1, parsePageParams, cursorQueryArgs, buildPage } from "@/lib/api-v1";
import { createBranch } from "@/services/branch.service";
import { createBranchSchema } from "@/lib/validations/branch";

export const GET = withApiV1(
  async (req, { apiKey }) => {
    const page = parsePageParams(req.nextUrl.searchParams);
    const rows = await prisma.branch.findMany({
      where: { companyId: apiKey.companyId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorQueryArgs(page),
    });
    return NextResponse.json(buildPage(rows, page.limit));
  },
  { scopes: ["branches:read"] }
);

export const POST = withApiV1(
  async (req, { apiKey }) => {
    const { name } = createBranchSchema.parse(await req.json());
    const branch = await createBranch(apiKey.companyId, name);
    return NextResponse.json(branch, { status: 201 });
  },
  { scopes: ["branches:write"] }
);
