import "server-only";
import { prisma } from "@/lib/prisma";
import { generateCardCode } from "@/lib/codes";
import { cardPublicUrl } from "@/lib/card-url";
import { createGuestCompany } from "@/services/company.service";
import { decrementBlankChipStock } from "@/lib/site-settings";
import { createCampaign, updateCampaign, assignCampaign } from "@/services/campaign.service";
import { buildSyntheticAuthContext } from "@/lib/api-v1/auth";
import { log } from "@/lib/observability/logger";
import { sendEmail } from "@/lib/email";
import { confirmationEmailHtml, shippedEmailHtml, deliveredEmailHtml } from "@/lib/email-templates/store-order";
import { getStoreProduct } from "@/lib/store-products";
import { stripe } from "@/lib/stripe";
import type { Prisma } from "@/generated/prisma/client";

export class StoreOrderProvisionError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "StoreOrderProvisionError";
  }
}

/**
 * Cria os N `NFCCard`s de um pedido dentro de UMA transação — nunca um por
 * um fora dela. Antes desta fase, `createCard` era chamado num loop simples:
 * se o cartão de número 7 de 20 falhasse (colisão de código, erro de rede),
 * os 6 anteriores já estavam gravados no banco mas o pedido nunca era
 * marcado como provisionado — cartões órfãos, e uma nova tentativa criaria
 * outros 20 do zero. Geração de código não depende do client de
 * transação (é função pura), só a escrita em si usa `tx`. O QR não é gravado:
 * sai sob demanda de /api/qr/[code] (ADR-076).
 */
async function createCardsInTransaction(
  tx: Prisma.TransactionClient,
  companyId: string,
  count: number,
  namePrefix: string,
  generateEditTokens: boolean
) {
  const cards = [];
  for (let i = 1; i <= count; i++) {
    let uniqueCode = generateCardCode();
    while (await tx.nFCCard.findUnique({ where: { uniqueCode } })) {
      uniqueCode = generateCardCode();
    }
    // Portal leve /meu-cartao (Fase 18) — só cartões de empresas GUEST
    // ganham um link pessoal de autoedição; uma empresa CUSTOMER já tem o
    // dashboard completo com RBAC de verdade, um segundo token seria
    // superfície de risco sem uso nenhum.
    let editToken: string | null = null;
    if (generateEditTokens) {
      editToken = generateCardCode(20);
      while (await tx.nFCCard.findUnique({ where: { editToken } })) {
        editToken = generateCardCode(20);
      }
    }
    const card = await tx.nFCCard.create({
      data: { companyId, uniqueCode, editToken, name: `${namePrefix} #${i}`, tags: [] },
    });
    cards.push(card);
  }
  return cards;
}

/**
 * Ponte Loja → SaaS (Fase 17/18) — transforma um `StoreOrder` pago em
 * `NFCCard`s reais. Chamada automaticamente pelo webhook do Stripe assim que
 * o pagamento é confirmado (o caminho principal) e, como fallback manual,
 * pelo botão "Provisionar" do Painel Admin quando o webhook falha por
 * algum motivo. Idempotente: um pedido já provisionado recusa rodar de novo.
 *
 * Resolução de empresa, em ordem: (1) `companyId` já gravado no pedido
 * (associação silenciosa no checkout, ou checkout combinado já autenticado);
 * (2) um `User` existente com o mesmo e-mail do comprador; (3) se nenhum dos
 * dois existir, cria uma `Company GUEST` nova — nunca mais um pedido pago
 * fica preso esperando o cliente "criar conta com o mesmo e-mail".
 */
export async function provisionStoreOrder(orderId: string) {
  const order = await prisma.storeOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new StoreOrderProvisionError("Pedido não encontrado", 404);
  if (order.provisionedAt) {
    throw new StoreOrderProvisionError("Este pedido já foi provisionado — os cartões já existem.", 409);
  }
  if (order.status !== "PAID" && order.status !== "SHIPPED" && order.status !== "DELIVERED") {
    throw new StoreOrderProvisionError("Só é possível provisionar um pedido já pago.", 400);
  }

  let companyId = order.companyId;
  let createdGuestCompany = false;
  if (!companyId) {
    const user = await prisma.user.findFirst({ where: { email: order.customerEmail }, select: { companyId: true } });
    companyId = user?.companyId ?? null;
  }
  if (!companyId) {
    const guestCompany = await createGuestCompany({
      name: order.customerName,
      whatsapp: order.customerPhone ?? "",
      destinationUrl: order.destinationUrl,
    });
    companyId = guestCompany.id;
    createdGuestCompany = true;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, googleReviewUrl: true, accountType: true },
  });
  if (!company) throw new StoreOrderProvisionError("Empresa vinculada não existe mais", 422);

  const orderShort = order.id.slice(-5).toUpperCase();

  // Segurança/correção (Auditoria Nível Bilionário, 11/09/2026) — antes
  // desta trava, duas coisas podiam duplicar cartões: (1) o Stripe entrega
  // o mesmo webhook mais de uma vez por garantia própria — duas chamadas
  // concorrentes a esta função podiam as duas passar pela checagem de
  // `provisionedAt` antes de qualquer uma escrever; (2) se a criação da
  // campanha (abaixo) falhasse depois dos cartões já criados, uma nova
  // tentativa manual recriava outros N cartões do zero. `SELECT ... FOR
  // UPDATE` trava a LINHA do pedido no Postgres — uma segunda transação
  // concorrente para a mesma linha espera a primeira terminar, e ao
  // continuar já enxerga `provisionedCardIds` preenchido (reaproveita em
  // vez de recriar). O array é persistido ANTES da campanha rodar,
  // exatamente para o caso (2).
  const cards = await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ provisionedCardIds: string[] }[]>`
      SELECT "provisionedCardIds" FROM "StoreOrder" WHERE id = ${orderId} FOR UPDATE
    `;
    const existingIds = locked?.provisionedCardIds ?? [];
    if (existingIds.length > 0) {
      return tx.nFCCard.findMany({ where: { id: { in: existingIds } } });
    }
    const created = await createCardsInTransaction(
      tx,
      companyId!,
      order.quantity,
      `Cartão loja ${orderShort}`,
      company.accountType === "GUEST"
    );
    await tx.storeOrder.update({ where: { id: orderId }, data: { provisionedCardIds: created.map((c) => c.id) } });
    return created;
  });
  await decrementBlankChipStock(cards.length).catch(() => {});

  // Uma empresa GUEST nunca tem fluxo de avaliação por trás — sempre cria a
  // campanha explícita, nunca compara com `googleReviewUrl` (que ali é só o
  // placeholder inerte setado por createGuestCompany). Uma empresa CUSTOMER
  // mantém a checagem original: não duplica campanha se o destino pedido já
  // é exatamente o fallback que a empresa já tinha configurado.
  const needsExplicitCampaign =
    company.accountType === "GUEST" || (order.destinationUrl && order.destinationUrl !== company.googleReviewUrl);

  if (needsExplicitCampaign) {
    const ctx = await buildSyntheticAuthContext(companyId);
    const campaign = await createCampaign(companyId, {
      name: `Direcionamento inicial — Pedido ${orderShort}`,
      description: `Criada automaticamente ao provisionar o pedido da loja ${orderShort}.`,
      type: "URL_REDIRECT",
      priority: 0,
      recurrenceType: "NONE",
      tags: [],
      config: { url: order.destinationUrl },
    });
    // Bug real corrigido na Fase 18: toda campanha nova nasce DRAFT (ver
    // comentário de createCampaign em campaign.service.ts) e o motor de
    // resolução só carrega campanhas ACTIVE como candidatas (ver
    // resolution-engine/data.ts) — sem este passo, o link escolhido na
    // compra NUNCA entrava em vigor de verdade, o cartão sempre caía no
    // fallback de avaliação Google independente do que o cliente pediu.
    await updateCampaign(companyId, campaign.id, { status: "ACTIVE" });
    // Campanha do sistema, não do dono (ADR-078): o construtor do Pro não a
    // oferece para edição e a conversão ao assinar o Starter a reconhece. A
    // origem não faz parte do que o usuário pode enviar, por isso é gravada aqui.
    await prisma.campaign.update({ where: { id: campaign.id }, data: { origin: "SYSTEM_DIRECT" } });
    for (const card of cards) {
      await assignCampaign(ctx, campaign.id, { scope: "CARD", cardId: card.id });
    }
  }

  await prisma.storeOrder.update({
    where: { id: orderId },
    data: { provisionedAt: new Date(), companyId },
  });

  if (createdGuestCompany) {
    log.info("store-order", `Empresa convidada criada automaticamente para o pedido ${orderShort}`, {
      orderId,
      companyId,
    });
  }

  // E-mail transacional (12/09/2026) — best-effort, nunca bloqueia nem
  // reverte o provisionamento (os cartões já existem, o pagamento já foi
  // confirmado; um e-mail que falha não pode desfazer nenhum dos dois).
  // Sempre depois de tudo mais ter sucesso, nunca antes.
  await sendOrderEmail(orderId, "confirmation").catch(() => {});

  return cards.map((c) => ({
    id: c.id,
    name: c.name,
    uniqueCode: c.uniqueCode,
    publicUrl: cardPublicUrl(c.uniqueCode),
    editToken: c.editToken,
  }));
}

type OrderEmailKind = "confirmation" | "shipped" | "delivered";

const EMAIL_TIMESTAMP_FIELD: Record<OrderEmailKind, "confirmationEmailSentAt" | "shippedEmailSentAt" | "deliveredEmailSentAt"> = {
  confirmation: "confirmationEmailSentAt",
  shipped: "shippedEmailSentAt",
  delivered: "deliveredEmailSentAt",
};

/**
 * Idempotente por etapa: se `[kind]EmailSentAt` já está preenchido, não
 * reenvia (evita duplicar em caso de nova tentativa/retry da rota que
 * chamou) — a menos que `force` seja passado, usado só pelo botão
 * "Reenviar e-mail" do Admin (o humano decidiu explicitamente reenviar,
 * então a proteção contra duplicidade automática não se aplica). Se o envio
 * falhar (`sent: false`), o timestamp NÃO é atualizado — a próxima chamada
 * tenta de novo, em vez de marcar como enviado algo que nunca saiu de
 * verdade.
 */
export async function sendOrderEmail(orderId: string, kind: OrderEmailKind, options?: { force?: boolean }) {
  const field = EMAIL_TIMESTAMP_FIELD[kind];
  const order = await prisma.storeOrder.findUnique({ where: { id: orderId } });
  if (!order) return { sent: false };
  if (order[field] && !options?.force) return { sent: false };

  const base = {
    customerName: order.customerName,
    orderShort: order.id.slice(-5).toUpperCase(),
    productLabel: getStoreProduct(order.productId)?.name ?? "Cartões NFC",
    quantity: order.quantity,
    amountTotalCents: order.amountTotalCents,
  };

  const html =
    kind === "confirmation"
      ? confirmationEmailHtml(base)
      : kind === "shipped"
        ? shippedEmailHtml({ ...base, trackingCode: order.trackingCode, carrier: order.carrier })
        : deliveredEmailHtml(base);

  const subject =
    kind === "confirmation"
      ? `Pedido #${base.orderShort} confirmado`
      : kind === "shipped"
        ? `Pedido #${base.orderShort} enviado`
        : `Pedido #${base.orderShort} entregue`;

  const { sent } = await sendEmail({ to: order.customerEmail, subject, html });
  if (sent) {
    await prisma.storeOrder.update({ where: { id: orderId }, data: { [field]: new Date() } });
  }
  return { sent };
}

/**
 * Checklist de produção (Fase 18) — cada marca é uma ação humana explícita
 * no Painel Admin, nunca inferida. `status` (o resumo simplificado que o
 * cliente vê) só avança para SHIPPED/DELIVERED nestes dois passos; os
 * demais só preenchem o timestamp interno, sem mudar `status`.
 */
export async function markStockConfirmed(orderId: string) {
  return prisma.storeOrder.update({ where: { id: orderId }, data: { stockConfirmedAt: new Date() } });
}

/** Fase 19.3 — "Impressão" vira etapa própria do quadro de 8 colunas. */
export async function markPrinted(orderId: string) {
  return prisma.storeOrder.update({ where: { id: orderId }, data: { printedAt: new Date() } });
}

export async function markNfcWritten(orderId: string) {
  return prisma.storeOrder.update({ where: { id: orderId }, data: { nfcWrittenAt: new Date() } });
}

export async function markQcPassed(orderId: string) {
  return prisma.storeOrder.update({ where: { id: orderId }, data: { qcPassedAt: new Date() } });
}

export async function markPackaged(orderId: string) {
  return prisma.storeOrder.update({ where: { id: orderId }, data: { packagedAt: new Date() } });
}

export async function markShipped(orderId: string, input: { trackingCode?: string; carrier?: string }) {
  const order = await prisma.storeOrder.update({
    where: { id: orderId },
    data: { status: "SHIPPED", shippedAt: new Date(), trackingCode: input.trackingCode, carrier: input.carrier },
  });
  await sendOrderEmail(orderId, "shipped").catch(() => {});
  return order;
}

export async function markDelivered(orderId: string) {
  const order = await prisma.storeOrder.update({
    where: { id: orderId },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  await sendOrderEmail(orderId, "delivered").catch(() => {});
  return order;
}

/**
 * Reembolso (Auditoria do Fluxo de Vendas, 12/09/2026) — antes desta função,
 * "Cancelar" no Admin só mudava o `status` no banco; o dinheiro do cliente
 * continuava cobrado de verdade no Stripe até alguém entrar manualmente no
 * Dashboard e estornar à parte. Sempre reembolsa no Stripe PRIMEIRO — só
 * grava `REFUNDED`/`refundedAt` se o Stripe confirmar, nunca o contrário
 * (um reembolso "registrado" que nunca aconteceu de verdade seria pior que
 * nenhum registro). `amountCents` omitido reembolsa o valor total.
 */
export async function refundStoreOrder(orderId: string, amountCents?: number) {
  const order = await prisma.storeOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new StoreOrderProvisionError("Pedido não encontrado", 404);
  if (order.status === "REFUNDED") throw new StoreOrderProvisionError("Este pedido já foi reembolsado.", 409);
  if (!order.stripePaymentIntentId) {
    throw new StoreOrderProvisionError("Este pedido não tem um pagamento do Stripe associado para reembolsar.", 422);
  }
  if (!stripe) throw new StoreOrderProvisionError("Stripe não configurado.", 503);

  const refund = await stripe.refunds.create({
    payment_intent: order.stripePaymentIntentId,
    amount: amountCents,
  });

  return prisma.storeOrder.update({
    where: { id: orderId },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      refundAmountCents: refund.amount,
    },
  });
}

/** Notas internas (Auditoria do Fluxo de Vendas, 12/09/2026) — nunca visível
 * ao comprador, só ao super-admin. Histórico completo (nunca sobrescrito),
 * mais recente primeiro. */
export async function addStoreOrderNote(orderId: string, body: string) {
  return prisma.storeOrderNote.create({ data: { orderId, body } });
}

export async function listStoreOrderNotes(orderId: string) {
  return prisma.storeOrderNote.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } });
}

/** Usado pelo banner de acompanhamento do Dashboard (Fase 18) — o pedido
 * físico mais recente desta empresa que ainda não chegou a um estado final,
 * ou `null` se não houver nenhum (o caso normal de uma empresa que nunca
 * comprou cartões pela loja, ou cujo último pedido já foi entregue). */
export async function getInProgressOrderForCompany(companyId: string) {
  return prisma.storeOrder.findFirst({
    where: { companyId, status: { notIn: ["DELIVERED", "CANCELED"] } },
    orderBy: { createdAt: "desc" },
  });
}
