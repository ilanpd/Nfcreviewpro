import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listTopActionableRecommendations } from "@/services/recommendation-engine.service";

/**
 * Executive Copilot (Fase 11) — espelho somente-leitura para o Command
 * Center, mesmo padrão de todo `/api/dev/demo/*` desde a Fase 6 (ADR-027):
 * resolve `companyId` pela empresa fixa de demonstração, nunca por sessão.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") notFound();
  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ recommendations: [] });
  const recommendations = await listTopActionableRecommendations(company.id, 5);
  return NextResponse.json({ recommendations });
}
