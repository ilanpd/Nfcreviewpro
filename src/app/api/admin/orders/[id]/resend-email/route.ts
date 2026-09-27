import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { sendOrderEmail, StoreOrderProvisionError } from "@/services/store-order.service";
import type { StoreOrderStatus } from "@/generated/prisma/client";

const KIND_BY_STATUS: Partial<Record<StoreOrderStatus, "confirmation" | "shipped" | "delivered">> = {
  PAID: "confirmation",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
};

/** Auditoria do Fluxo de Vendas (12/09/2026) — reenvia o e-mail da etapa
 * atual do pedido (confirmação/envio/entrega) sob demanda, ignorando a
 * proteção normal contra duplicidade — é o admin pedindo explicitamente. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const order = await prisma.storeOrder.findUnique({ where: { id }, select: { status: true } });
    if (!order) throw new StoreOrderProvisionError("Pedido não encontrado", 404);

    const kind = KIND_BY_STATUS[order.status];
    if (!kind) {
      throw new StoreOrderProvisionError("Este pedido ainda não chegou a uma etapa com e-mail (aguardando pagamento ou já cancelado/reembolsado).", 400);
    }

    const result = await sendOrderEmail(id, kind, { force: true });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
