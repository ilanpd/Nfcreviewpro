import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/super-admin";
import { handleApiError } from "@/lib/api-error";
import { BOARD_COLUMNS, type BoardColumn } from "@/domain/store-order/board";
import { advanceOrderToStage, undoOrderStage } from "@/services/store-order.service";

const COLUMN_KEYS = BOARD_COLUMNS.map((c) => c.key) as [BoardColumn, ...BoardColumn[]];

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ADVANCE_TO"),
    target: z.enum(COLUMN_KEYS),
    trackingCode: z.string().trim().max(120).optional(),
    carrier: z.string().trim().max(60).optional(),
  }),
  z.object({ action: z.literal("UNDO") }),
]);

/**
 * A etapa do pedido, em um gesto só: `ADVANCE_TO` leva o pedido até a etapa
 * pedida (marcando os passos no caminho) e `UNDO` desfaz o último passo de
 * produção. Substitui ter de arrastar um cartão no quadro para mudar de etapa.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const input = bodySchema.parse(await req.json());
    const order =
      input.action === "ADVANCE_TO"
        ? await advanceOrderToStage(id, input.target, { trackingCode: input.trackingCode, carrier: input.carrier })
        : await undoOrderStage(id);
    return NextResponse.json({ order });
  } catch (error) {
    return handleApiError(error);
  }
}
