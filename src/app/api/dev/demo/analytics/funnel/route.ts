import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getFunnel } from "@/services/analytics-engine.service";

/** Equivalente de /api/analytics/funnel para o Command Center — ver ADR-027. */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada — rode o seed" }, { status: 404 });

  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? "30")));
  const funnel = await getFunnel(company.id, days);
  return NextResponse.json({ funnel });
}
