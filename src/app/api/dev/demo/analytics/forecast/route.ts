import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getReviewGoalForecast, getTopCampaignTrend } from "@/services/forecast-engine.service";
import { devToolsEnabled } from "@/lib/dev/gate";

/** Equivalente de /api/analytics/forecast para o Command Center — ver ADR-027. */
export async function GET(req: NextRequest) {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada — rode o seed" }, { status: 404 });

  const goal = Math.max(1, Number(req.nextUrl.searchParams.get("goal") ?? "100"));
  const [reviewGoal, campaignTrend] = await Promise.all([getReviewGoalForecast(company.id, goal), getTopCampaignTrend(company.id)]);
  return NextResponse.json({ reviewGoal, campaignTrend });
}
