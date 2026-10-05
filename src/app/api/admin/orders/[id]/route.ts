import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { markShipped, markDelivered, listStoreOrderNotes, StoreOrderProvisionError } from "@/services/store-order.service";
import { getStoreProduct } from "@/lib/store-products";
import { cardPublicUrl, getCardUrlGuard } from "@/lib/card-url";

const bodySchema = z.object({
  status: z.enum(["SHIPPED", "DELIVERED", "CANCELED"]),
  trackingCode: z.string().trim().max(120).optional(),
  carrier: z.string().trim().max(60).optional(),
});

/**
 * Auditoria do Fluxo de Vendas (12/09/2026) — payload único para o painel de
 * detalhe do pedido: junta o pedido, os cartões já provisionados, as notas
 * internas e o link direto pro pagamento no Stripe, pra Sheet nunca precisar
 * de 4 chamadas separadas pra montar uma tela.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const order = await prisma.storeOrder.findUnique({ where: { id } });
    if (!order) throw new StoreOrderProvisionError("Pedido não encontrado", 404);

    const [cards, notes, plates] = await Promise.all([
      order.provisionedCardIds.length > 0
        ? prisma.nFCCard.findMany({ where: { id: { in: order.provisionedCardIds } }, select: { id: true, name: true, uniqueCode: true } })
        : Promise.resolve([]),
      listStoreOrderNotes(id),
      // Estoque de placas (ADR-092): um acréscimo — qualquer falha vira "sem placa".
      order.provisionedCardIds.length > 0
        ? prisma.plate
            .findMany({ where: { cardId: { in: order.provisionedCardIds } }, select: { cardId: true, serial: true, status: true, batch: { select: { code: true } } } })
            .catch(() => [] as { cardId: string | null; serial: string; status: string; batch: { code: string } }[])
        : Promise.resolve([] as { cardId: string | null; serial: string; status: string; batch: { code: string } }[]),
    ]);
    const plateByCard = new Map(plates.map((p) => [p.cardId, { serial: p.serial, status: p.status, batchCode: p.batch.code }]));

    const stripeMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "" : "test/";
    const stripeDashboardUrl = order.stripePaymentIntentId
      ? `https://dashboard.stripe.com/${stripeMode}payments/${order.stripePaymentIntentId}`
      : null;

    // ADR-076: a URL vai para o programador de chips. Com o ambiente exigindo
    // endereço definitivo e ele ainda provisório, a lista não sai — melhor um
    // aviso vermelho do que um lote de chips gravado com endereço que vai mudar.
    const guard = getCardUrlGuard();
    return NextResponse.json({
      order,
      productLabel: getStoreProduct(order.productId)?.name ?? order.productId,
      cardUrl: { kind: guard.status.kind, host: guard.status.host, message: guard.status.message, blocked: guard.blocked },
      cards: cards.map((c) => ({ ...c, publicUrl: guard.blocked ? null : cardPublicUrl(c.uniqueCode), plate: plateByCard.get(c.id) ?? null })),
      notes,
      stripeDashboardUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Painel Admin (Fase 16/18) — só avança PAID→SHIPPED→DELIVERED (ou cancela).
 * PENDING_PAYMENT→PAID nunca é setado aqui: essa transição é exclusiva do
 * webhook do Stripe (ver /api/stripe/webhook) — o admin nunca "confirma" um
 * pagamento manualmente, só o próprio Stripe pode dizer que o dinheiro
 * entrou. SHIPPED/DELIVERED passam pelo service (marca o timestamp granular
 * junto com o status resumido) — ver /checklist/route.ts para as etapas
 * intermediárias que não mudam `status`.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const input = bodySchema.parse(await req.json());

    let order;
    if (input.status === "SHIPPED") {
      order = await markShipped(id, { trackingCode: input.trackingCode, carrier: input.carrier });
    } else if (input.status === "DELIVERED") {
      order = await markDelivered(id);
    } else {
      order = await prisma.storeOrder.update({ where: { id }, data: { status: input.status } });
    }
    return NextResponse.json({ order });
  } catch (error) {
    return handleApiError(error);
  }
}
