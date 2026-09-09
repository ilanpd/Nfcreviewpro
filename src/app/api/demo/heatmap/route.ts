import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getHeatmapCounts, getLastInteractionByCard } from "@/services/heatmap.service";
import type { HeatmapLayer } from "@/domain/heatmap/types";

const COUNT_LAYERS: HeatmapLayer[] = ["APPROACHES", "CONVERSIONS", "GOOGLE_REVIEWS", "INSTAGRAM"];

/**
 * Demo OS (Fase 12) — equivalente PÚBLICO (nunca bloqueado por
 * `NODE_ENV === "production"`) de `/api/dev/demo/heatmap`: o Command Center
 * é uma ferramenta de engenharia, sempre bloqueada em produção (ADR-027);
 * o Demo OS é uma vitrine pública, deliberadamente alcançável em produção.
 * Mesma empresa fixa (`getDemoCompany()`), mesmas funções de serviço —
 * nunca uma segunda agregação.
 */
export async function GET(req: NextRequest) {
  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada" }, { status: 404 });

  const layer = (req.nextUrl.searchParams.get("layer") ?? "APPROACHES") as HeatmapLayer;
  const hours = Number(req.nextUrl.searchParams.get("hours") ?? "24");
  const since = new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000);

  if (layer === "LAST_INTERACTION") {
    const map = await getLastInteractionByCard(company.id, since);
    return NextResponse.json({ lastInteraction: Object.fromEntries([...map.entries()].map(([id, d]) => [id, d.toISOString()])) });
  }
  if (!COUNT_LAYERS.includes(layer)) {
    return NextResponse.json({ error: "Camada de heatmap inválida" }, { status: 400 });
  }

  const counts = await getHeatmapCounts(company.id, layer as Exclude<HeatmapLayer, "CURRENT_CAMPAIGN" | "LAST_INTERACTION">, since);
  return NextResponse.json({ counts });
}
