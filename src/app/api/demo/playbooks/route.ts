import { NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listTopActionableRecommendations } from "@/services/recommendation-engine.service";

/** Demo OS (Fase 12) — equivalente PÚBLICO do feed de recomendações do Executive Copilot. */
export async function GET() {
  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ recommendations: [] });
  const recommendations = await listTopActionableRecommendations(company.id, 5);
  return NextResponse.json({ recommendations });
}
