import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { STAGE_ORDER, type PlateStage } from "@/domain/plates/status";
import { listPlates } from "@/services/plates.service";

/** Busca rápida por série, código ou cliente — alimenta os campos de número da placa no painel. */
export async function GET(req: NextRequest) {
  try {
    await requirePlateAdmin();
    const params = req.nextUrl.searchParams;
    const q = params.get("q")?.trim() ?? "";
    const stageParam = params.get("stage");
    const stage = STAGE_ORDER.find((s): s is PlateStage => s === stageParam);
    // Sem texto, só vale com um filtro de etapa (ex.: "a próxima do estoque").
    if (q.length < 2 && !stage) return NextResponse.json({ plates: [] });
    const { plates } = await listPlates({
      q: q.length >= 2 ? q : undefined,
      stage,
      modelId: params.get("modelId") || undefined,
      fifo: params.get("fifo") === "1",
      take: Math.min(Number(params.get("take")) || 8, 20),
    });
    return NextResponse.json({
      plates: plates.map((p) => ({ id: p.id, serial: p.serial, stage: p.stage, modelName: p.modelName, companyName: p.card?.companyName ?? null })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
