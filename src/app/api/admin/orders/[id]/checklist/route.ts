import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/super-admin";
import { handleApiError } from "@/lib/api-error";
import { markStockConfirmed, markPrinted, markNfcWritten, markQcPassed, markPackaged } from "@/services/store-order.service";

const STEP_HANDLERS = {
  STOCK_CONFIRMED: markStockConfirmed,
  PRINTED: markPrinted,
  NFC_WRITTEN: markNfcWritten,
  QC_PASSED: markQcPassed,
  PACKAGED: markPackaged,
} as const;

const bodySchema = z.object({ step: z.enum(["STOCK_CONFIRMED", "PRINTED", "NFC_WRITTEN", "QC_PASSED", "PACKAGED"]) });

/**
 * Centro de Operações (Fase 18) — as etapas da esteira de produção que não
 * mexem no `status` resumido (esse cliente vê SHIPPED/DELIVERED só, ver
 * /api/admin/orders/[id]/route.ts). Cada etapa é uma ação humana explícita
 * no quadro do Admin, nunca inferida.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const { step } = bodySchema.parse(await req.json());
    const order = await STEP_HANDLERS[step](id);
    return NextResponse.json({ order });
  } catch (error) {
    return handleApiError(error);
  }
}
