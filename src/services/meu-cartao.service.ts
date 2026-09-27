import "server-only";
import { prisma } from "@/lib/prisma";
import { createCampaign, updateCampaign, assignCampaign } from "@/services/campaign.service";
import { buildSyntheticAuthContext } from "@/lib/api-v1/auth";
import { sendEmail } from "@/lib/email";
import { personalLinkRecoveryEmailHtml } from "@/lib/email-templates/meu-cartao";
import { BRAND } from "@/lib/brand";
import type { NFCCard, Company } from "@/generated/prisma/client";

/**
 * Portal leve `/meu-cartao` para clientes GUEST (Fase 18, revisado ADR-080).
 * Único lugar que decide "este link ainda é do portal avulso" — antes desta
 * fase, essa checagem existia duplicada em `page.tsx` e em `route.ts`, e um
 * link cujo dono virou assinante (`claimGuestCompany`) simplesmente devolvia
 * 404 (achado do plano, J6: "Portal antigo — hoje devolve 404 depois de
 * assinar").
 */
export type GuestCardLookup =
  | { status: "OK"; card: NFCCard & { company: Company } }
  /** A empresa deixou de ser GUEST (assinou o Starter): o link "formou" — manda para o painel. */
  | { status: "GRADUATED" }
  | { status: "NOT_FOUND" };

export async function findGuestCard(editToken: string): Promise<GuestCardLookup> {
  const card = await prisma.nFCCard.findUnique({ where: { editToken }, include: { company: true } });
  if (!card) return { status: "NOT_FOUND" };
  if (card.company.accountType !== "GUEST") return { status: "GRADUATED" };
  return { status: "OK", card };
}

export async function getCardDestination(cardId: string, fallbackUrl: string) {
  const assignment = await prisma.campaignAssignment.findFirst({
    where: { cardId, scope: "CARD" },
    include: { campaign: true },
    orderBy: { createdAt: "desc" },
  });
  const config = assignment?.campaign.config as { url?: string } | null;
  return { assignment, destinationUrl: config?.url ?? fallbackUrl };
}

/**
 * Toques do mês (ADR-080). Antes contava `Visit`, que só é gravado no fluxo do
 * Retorno/estrelas — um cartão avulso com redirecionamento direto nunca
 * passava por ali, e o contador tendia a mostrar zero (achado do plano,
 * documento "O que cada opção entrega", item 2). `RedirectLog` é escrito pelo
 * motor de resolução em TODO toque, com ou sem Retorno — é a contagem certa.
 */
export async function countCardTouchesThisMonth(cardId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  return prisma.redirectLog.count({ where: { cardId, createdAt: { gte: startOfMonth } } });
}

export async function updateCardDestination(companyId: string, cardId: string, destinationUrl: string) {
  const { assignment } = await getCardDestination(cardId, "");
  if (assignment) {
    await updateCampaign(companyId, assignment.campaignId, { config: { url: destinationUrl } });
    return;
  }
  // Caso defensivo — todo cartão GUEST sai do provisionamento com uma
  // atribuição já criada; só chega aqui se algo externo a removeu.
  const ctx = await buildSyntheticAuthContext(companyId);
  const campaign = await createCampaign(companyId, {
    name: "Direcionamento — editado pelo cliente",
    type: "URL_REDIRECT",
    priority: 0,
    recurrenceType: "NONE",
    tags: [],
    config: { url: destinationUrl },
  });
  await updateCampaign(companyId, campaign.id, { status: "ACTIVE" });
  await assignCampaign(ctx, campaign.id, { scope: "CARD", cardId });
}

/**
 * "Perdi o link pessoal" (J7 do plano): recupera por e-mail, sempre com a
 * mesma resposta pública (nunca revela se o e-mail existe — ver a rota).
 * Localiza a empresa pelo e-mail do COMPRADOR do pedido (`StoreOrder`), única
 * ligação que existe para uma empresa GUEST, que nunca tem `User`.
 */
export async function sendPersonalLinkRecoveryEmail(email: string): Promise<void> {
  const orders = await prisma.storeOrder.findMany({
    where: { customerEmail: email, companyId: { not: null } },
    select: { companyId: true },
  });
  const orderedCompanyIds = [...new Set(orders.map((o) => o.companyId!))];
  if (orderedCompanyIds.length === 0) return;

  // StoreOrder.companyId é um campo solto, sem relação declarada no schema
  // (um pedido pode ter sido feito antes de existir empresa) — o filtro por
  // accountType precisa de uma segunda consulta, contra Company mesmo.
  const guestCompanies = await prisma.company.findMany({
    where: { id: { in: orderedCompanyIds }, accountType: "GUEST" },
    select: { id: true },
  });
  const companyIds = guestCompanies.map((c) => c.id);
  if (companyIds.length === 0) return;

  const cards = await prisma.nFCCard.findMany({
    where: { companyId: { in: companyIds }, editToken: { not: null } },
    select: { name: true, editToken: true },
    orderBy: { createdAt: "asc" },
  });
  if (cards.length === 0) return;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const links = cards.map((c) => ({ name: c.name, url: `${base}/meu-cartao/${c.editToken}` }));
  await sendEmail({ to: email, subject: `Seus links de cartão — ${BRAND.name}`, html: personalLinkRecoveryEmailHtml(links) });
}
