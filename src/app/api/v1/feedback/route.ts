import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiV1, parsePageParams, cursorQueryArgs, buildPage, ApiV1Error } from "@/lib/api-v1";

export const GET = withApiV1(
  async (req, { apiKey }) => {
    const params = req.nextUrl.searchParams;
    const page = parsePageParams(params);
    const resolvedParam = params.get("resolved");
    if (resolvedParam !== null && resolvedParam !== "true" && resolvedParam !== "false") {
      throw new ApiV1Error("validation_error", '"resolved" deve ser "true" ou "false".');
    }

    const rows = await prisma.privateFeedback.findMany({
      where: { companyId: apiKey.companyId, ...(resolvedParam !== null ? { resolved: resolvedParam === "true" } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorQueryArgs(page),
    });
    return NextResponse.json(buildPage(rows, page.limit));
  },
  { scopes: ["feedback:read"] }
);
