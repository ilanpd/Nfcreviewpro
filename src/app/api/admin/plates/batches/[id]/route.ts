import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { markBatchReceived, markBatchSent } from "@/services/plates.service";

const schema = z.object({ action: z.enum(["send", "receive"]) });

/** Marcos do lote: "enviado à gráfica" e "recebido". Cada um grava a data e entra na trilha de cada placa. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePlateAdmin();
    const { id } = await params;
    const { action } = schema.parse(await req.json());
    if (action === "send") await markBatchSent(id, actor);
    else await markBatchReceived(id, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
