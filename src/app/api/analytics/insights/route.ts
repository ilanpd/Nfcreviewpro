import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getInsights } from "@/services/insights-engine.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? "30")));
    const insights = await getInsights(ctx.companyId, days);
    return NextResponse.json({ insights });
  } catch (error) {
    return handleApiError(error);
  }
}
