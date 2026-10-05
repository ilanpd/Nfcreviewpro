import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminEmail, isSuperAdmin } from "@/lib/super-admin";
import { directSaleSchema } from "@/lib/validations/store-order";
import { createDirectSaleOrder } from "@/services/store-order.service";
import { handleApiError } from "@/lib/api-error";

/**
 * Venda direta (C14, ADR-089) — o dono vende o cartão físico por fora do
 * site (pessoalmente, PIX, o que for). Cria o `StoreOrder` já `PAID` e
 * provisiona na mesma chamada — reaproveita 100% o pipeline da loja online,
 * nunca um caminho paralelo. Só o super-admin usa (é literalmente registrar
 * "eu já recebi o pagamento", uma afirmação que precisa de confiança).
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const input = directSaleSchema.parse(await req.json());
    const { order, editLinks, plates, plateError } = await createDirectSaleOrder(input, await getSuperAdminEmail());
    return NextResponse.json({ order, editLinks, plates, plateError }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
