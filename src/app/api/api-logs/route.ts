import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { listApiRequestLogs, getApiUsageSummary } from "@/services/api-request-log.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
    const [logs, summary] = await Promise.all([
      listApiRequestLogs(ctx.companyId, cursor),
      getApiUsageSummary(ctx.companyId),
    ]);
    return NextResponse.json({ logs, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
