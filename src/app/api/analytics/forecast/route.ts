import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getReviewGoalForecast, getTopCampaignTrend } from "@/services/forecast-engine.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const goal = Math.max(1, Number(req.nextUrl.searchParams.get("goal") ?? "100"));

    const [reviewGoal, campaignTrend] = await Promise.all([
      getReviewGoalForecast(ctx.companyId, goal),
      getTopCampaignTrend(ctx.companyId),
    ]);

    return NextResponse.json({ reviewGoal, campaignTrend });
  } catch (error) {
    return handleApiError(error);
  }
}
