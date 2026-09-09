import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getRoiSummary } from "@/services/analytics-engine.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? "30")));
    const roi = await getRoiSummary(ctx.companyId, days);
    return NextResponse.json({ roi });
  } catch (error) {
    return handleApiError(error);
  }
}
