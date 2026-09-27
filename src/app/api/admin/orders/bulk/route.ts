import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/super-admin";
import { handleApiError } from "@/lib/api-error";
import {
  markStockConfirmed,
  markPrinted,
  markNfcWritten,
  markQcPassed,
  markPackaged,
  markDelivered,
} from "@/services/store-order.service";

// "SHIPPED" fica de fora de propósito (Fase 19.3) — exige rastreio/
// transportadora individual (ver `confirmShipment` em `orders-board.tsx`),
// nunca aplicável a N pedidos de uma vez.
const STEP_HANDLERS = {
  STOCK_CONFIRMED: markStockConfirmed,
  PRINTED: markPrinted,
  NFC_WRITTEN: markNfcWritten,
  QC_PASSED: markQcPassed,
  PACKAGED: markPackaged,
  DELIVERED: markDelivered,
} as const;

const bodySchema = z.object({
  orderIds: z.array(z.string()).min(1).max(200),
  step: z.enum(["STOCK_CONFIRMED", "PRINTED", "NFC_WRITTEN", "QC_PASSED", "PACKAGED", "DELIVERED"]),
});

/**
 * Centro de Operações (Fase 18) — ação em lote sobre vários pedidos
 * selecionados numa coluna do quadro, mesmo espírito do lote já existente em
 * /api/campaigns/[id]/assignments/bulk (uma chamada, N atualizações), mas
 * protegido por `isSuperAdmin()` em vez de RBAC de empresa — esta rota
 * nunca pertence ao contexto de uma empresa cliente.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { orderIds, step } = bodySchema.parse(await req.json());
    const handler = STEP_HANDLERS[step];
    const results = await Promise.allSettled(orderIds.map((id) => handler(id)));
    const updated = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ updated, failed: orderIds.length - updated });
  } catch (error) {
    return handleApiError(error);
  }
}
