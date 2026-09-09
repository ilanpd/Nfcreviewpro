import { NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getExecutiveKpis, getRoiSummary } from "@/services/analytics-engine.service";

/** Demo OS (Fase 12) — números do Hero/KPIs ao vivo, mesmos motores do dashboard real. */
export async function GET() {
  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada" }, { status: 404 });

  const [kpis, roi] = await Promise.all([getExecutiveKpis(company.id, 30), getRoiSummary(company.id, 30)]);
  return NextResponse.json({ kpis, roi });
}
