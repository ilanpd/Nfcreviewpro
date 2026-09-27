import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/super-admin";
import { handleApiError } from "@/lib/api-error";
import { refundStoreOrder } from "@/services/store-order.service";

const bodySchema = z.object({ amountCents: z.number().int().positive().optional() });

/**
 * Auditoria do Fluxo de Vendas (12/09/2026) — fecha o ciclo financeiro que
 * "Cancelar" nunca fechou sozinho: reembolsa de verdade no Stripe antes de
 * marcar o pedido como `REFUNDED`. `amountCents` omitido reembolsa o valor
 * total pago.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const { amountCents } = bodySchema.parse(await req.json().catch(() => ({})));
    const order = await refundStoreOrder(id, amountCents);
    return NextResponse.json({ order });
  } catch (error) {
    return handleApiError(error);
  }
}
