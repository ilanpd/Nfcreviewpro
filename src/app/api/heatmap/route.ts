import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getHeatmapCounts, getLastInteractionByCard } from "@/services/heatmap.service";
import { handleApiError } from "@/lib/api-error";
import type { HeatmapLayer } from "@/domain/heatmap/types";

const COUNT_LAYERS: HeatmapLayer[] = ["APPROACHES", "CONVERSIONS", "GOOGLE_REVIEWS", "INSTAGRAM"];

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const layer = (req.nextUrl.searchParams.get("layer") ?? "APPROACHES") as HeatmapLayer;
    const hours = Number(req.nextUrl.searchParams.get("hours") ?? "24");
    const since = new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000);

    if (layer === "LAST_INTERACTION") {
      const map = await getLastInteractionByCard(ctx.companyId, since);
      return NextResponse.json({ lastInteraction: Object.fromEntries([...map.entries()].map(([id, d]) => [id, d.toISOString()])) });
    }

    if (!COUNT_LAYERS.includes(layer)) {
      return NextResponse.json({ error: "Camada de heatmap inválida" }, { status: 400 });
    }

    const counts = await getHeatmapCounts(ctx.companyId, layer as Exclude<HeatmapLayer, "CURRENT_CAMPAIGN" | "LAST_INTERACTION">, since);
    return NextResponse.json({ counts });
  } catch (error) {
    return handleApiError(error);
  }
}
