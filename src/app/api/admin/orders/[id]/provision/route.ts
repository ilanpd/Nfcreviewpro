import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { provisionStoreOrder } from "@/services/store-order.service";
import { cardPublicUrl, getCardUrlGuard } from "@/lib/card-url";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const order = await prisma.storeOrder.findUnique({ where: { id }, select: { provisionedCardIds: true } });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    const cards = await prisma.nFCCard.findMany({
      where: { id: { in: order.provisionedCardIds } },
      select: { id: true, name: true, uniqueCode: true },
    });
    // ADR-076: mesma regra da rota de detalhe — sem endereço definitivo (quando
    // exigido), a URL do chip não sai.
    const guard = getCardUrlGuard();
    return NextResponse.json({
      cardUrl: { kind: guard.status.kind, host: guard.status.host, message: guard.status.message, blocked: guard.blocked },
      cards: cards.map((c) => ({ ...c, publicUrl: guard.blocked ? null : cardPublicUrl(c.uniqueCode) })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Ponte Loja → SaaS (Fase 17/18) — desde a Fase 18, o caminho principal é
 * automático: o webhook do Stripe chama `provisionStoreOrder` assim que o
 * pagamento é confirmado, inclusive criando uma empresa convidada quando
 * nenhuma conta existe para o e-mail do comprador (ver
 * services/store-order.service.ts e ADR-065). Esta rota vira só o fallback
 * manual — usada quando o webhook falha por algum motivo — mas a lógica de
 * verdade mora inteira no service, para nunca divergir entre os dois
 * caminhos.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const cards = await provisionStoreOrder(id);
    return NextResponse.json({ cards });
  } catch (error) {
    return handleApiError(error);
  }
}
