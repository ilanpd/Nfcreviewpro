import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { listAvailablePlates } from "@/services/plates.service";

/** As placas de UM lote que podem ser vendidas agora (conferidas e sem dono) — a lista do seletor de atribuição. */
export async function GET(req: NextRequest) {
  try {
    await requirePlateAdmin();
    const batchId = req.nextUrl.searchParams.get("batchId");
    if (!batchId) return NextResponse.json({ error: "Informe o lote (batchId)" }, { status: 400 });
    return NextResponse.json({ plates: await listAvailablePlates(batchId) });
  } catch (error) {
    return handleApiError(error);
  }
}
