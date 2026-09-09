import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getHeatmapCounts, getLastInteractionByCard } from "@/services/heatmap.service";
import type { HeatmapLayer } from "@/domain/heatmap/types";

const COUNT_LAYERS: HeatmapLayer[] = ["APPROACHES", "CONVERSIONS", "GOOGLE_REVIEWS", "INSTAGRAM"];

/** Equivalente de `/api/heatmap` para o Command Center — ver ADR-027. */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada — rode o seed" }, { status: 404 });

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
