import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getRanking, getTopOfEachRanking } from "@/services/ranking-engine.service";
import { handleApiError } from "@/lib/api-error";
import type { RankingType } from "@/domain/analytics/types";

const VALID_TYPES: RankingType[] = ["CAMPAIGN", "ZONE", "CARD", "EMPLOYEE", "HOUR", "DAY_OF_WEEK"];

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? "30")));
    const limit = Math.max(1, Math.min(50, Number(req.nextUrl.searchParams.get("limit") ?? "10")));
    const type = req.nextUrl.searchParams.get("type");

    if (type === "ALL") {
      const top = await getTopOfEachRanking(ctx.companyId, days);
      return NextResponse.json({ top });
    }

    if (!type || !VALID_TYPES.includes(type as RankingType)) {
      return NextResponse.json({ error: "Tipo de ranking inválido" }, { status: 400 });
    }

    const entries = await getRanking(ctx.companyId, type as RankingType, days, limit);
    return NextResponse.json({ entries });
  } catch (error) {
    return handleApiError(error);
  }
}
