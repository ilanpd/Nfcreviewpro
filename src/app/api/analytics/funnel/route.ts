import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getFunnel } from "@/services/analytics-engine.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
    const funnel = await getFunnel(ctx.companyId, Math.max(1, Math.min(365, days)));
    return NextResponse.json({ funnel });
  } catch (error) {
    return handleApiError(error);
  }
}
