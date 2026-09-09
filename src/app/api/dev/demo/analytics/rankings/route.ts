import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getRanking, getTopOfEachRanking } from "@/services/ranking-engine.service";
import type { RankingType } from "@/domain/analytics/types";

const VALID_TYPES: RankingType[] = ["CAMPAIGN", "ZONE", "CARD", "EMPLOYEE", "HOUR", "DAY_OF_WEEK"];

/** Equivalente de /api/analytics/rankings para o Command Center — ver ADR-027. */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada — rode o seed" }, { status: 404 });

  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? "30")));
  const limit = Math.max(1, Math.min(50, Number(req.nextUrl.searchParams.get("limit") ?? "10")));
  const type = req.nextUrl.searchParams.get("type");

  if (type === "ALL") {
    const top = await getTopOfEachRanking(company.id, days);
    return NextResponse.json({ top });
  }

  if (!type || !VALID_TYPES.includes(type as RankingType)) {
    return NextResponse.json({ error: "Tipo de ranking inválido" }, { status: 400 });
  }

  const entries = await getRanking(company.id, type as RankingType, days, limit);
  return NextResponse.json({ entries });
}
