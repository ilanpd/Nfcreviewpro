import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { orderPlatesSchema } from "@/lib/validations/plates";
import { assignPlatesToOrder, listOrdersWaitingForPlates } from "@/services/plates.service";

/** Pedidos pagos com cartões ainda sem placa (a fila para um lote sob demanda). */
export async function GET() {
  try {
    await requirePlateAdmin();
    return NextResponse.json({ orders: await listOrdersWaitingForPlates() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Entrega placas do estoque a um pedido (automático, primeiro a entrar primeiro a sair, ou por número). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePlateAdmin();
    const input = orderPlatesSchema.parse(await req.json());
    const results = await assignPlatesToOrder(input, actor);
    return NextResponse.json({ assigned: results });
  } catch (error) {
    return handleApiError(error);
  }
}
