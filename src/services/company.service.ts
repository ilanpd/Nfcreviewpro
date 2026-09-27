import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { invalidateCompany } from "@/lib/resolution-engine/cache";
import { invalidateBrandHostCache } from "@/lib/white-label/resolve-brand";
import { lookupTxtRecord } from "@/lib/white-label/dns";
import { getRootDomain } from "@/domain/white-label/host";
import { ForbiddenError } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import type { OnboardingInput, UpdateCompanyInput } from "@/lib/validations/company";
import { PLANS } from "@/lib/plans";
import { buildZoneActivityHeatmap, type ActivityEvent } from "@/domain/company/activity-heatmap";

export async function getCompanyById(companyId: string) {
  return prisma.company.findUniqueOrThrow({ where: { id: companyId } });
}

/**
 * E-mail para onde mandar avisos do sistema (mensagem nova, brinde ativado,
 * cobrança) — C9/F6. Não existe um campo `Company.email` dedicado (só o
 * e-mail de cada `User`), então isto pega o OWNER mais antigo da empresa,
 * que é sempre quem fez o cadastro original (`createCompanyForNewUser`/
 * `claimGuestCompany`, únicos lugares que criam um OWNER). `null` quando a
 * empresa não tem nenhum usuário ainda (nunca deveria acontecer para uma
 * CUSTOMER, mas uma GUEST legitimamente não tem — quem chama decide não
 * enviar nada nesse caso, nunca inventa um destinatário).
 */
export async function getCompanyOwnerEmail(companyId: string): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { companyId, role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  return owner?.email ?? null;
}

function subdomainHost(slug: string): string {
  return `${slug}.${getRootDomain()}`;
}

/** Invalida os dois hosts pelos quais esta empresa pode ser resolvida — o
 * subdomínio (sempre) e o domínio customizado (se houver um configurado no
 * momento da chamada). Chamado depois de qualquer edição que mude o que
 * `DomainResolver` devolveria para algum desses hosts. */
async function invalidateCompanyBrandCaches(company: { slug: string; domain: string | null }) {
  await invalidateBrandHostCache([subdomainHost(company.slug), company.domain]);
}

export async function updateCompany(companyId: string, input: UpdateCompanyInput) {
  const company = await prisma.company.update({ where: { id: companyId }, data: input });
  await invalidateCompany(companyId);
  await invalidateCompanyBrandCaches(company);
  return company;
}

// --- White Label (Fase 10): domínio customizado ---
// Ver lib/white-label/resolve-brand.ts para por que branding só resolve
// depois de `domainVerifiedAt` preenchido, e ADR-042 para o desenho
// completo da verificação.

export async function claimDomain(companyId: string, domain: string) {
  const existing = await prisma.company.findUnique({ where: { domain } });
  if (existing && existing.id !== companyId) {
    throw new ForbiddenError("Este domínio já está em uso por outra empresa.");
  }

  const domainVerificationToken = randomBytes(16).toString("hex");
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { domain, domainVerificationToken, domainVerifiedAt: null },
  });
  await invalidateCompany(companyId);
  await invalidateCompanyBrandCaches(company);
  return company;
}

export async function removeDomain(companyId: string) {
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { domain: null, domainVerificationToken: null, domainVerifiedAt: null },
  });
  await invalidateCompany(companyId);
  await invalidateCompanyBrandCaches({ ...company, domain: null });
  return company;
}

export interface DomainVerificationResult {
  verified: boolean;
  reason?: string;
}

export async function verifyDomainOwnership(companyId: string): Promise<DomainVerificationResult> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (!company.domain || !company.domainVerificationToken) {
    throw new ForbiddenError("Nenhum domínio pendente de verificação para esta empresa.");
  }

  const records = await lookupTxtRecord(`_nfcos-challenge.${company.domain}`);
  const verified = records.includes(company.domainVerificationToken);
  if (!verified) {
    return { verified: false, reason: "Registro TXT ainda não encontrado ou não corresponde. A propagação de DNS pode levar alguns minutos." };
  }

  await prisma.company.update({ where: { id: companyId }, data: { domainVerifiedAt: new Date() } });
  await invalidateCompanyBrandCaches(company);
  return { verified: true };
}

/** Creates a company for a brand-new Clerk user and makes them its OWNER. */
export async function createCompanyForNewUser(params: {
  clerkId: string;
  email: string;
  input: OnboardingInput;
}) {
  const { clerkId, email, input } = params;

  const baseSlug = slugify(input.name, { fallback: "empresa" });
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.company.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.name,
        slug,
        whatsapp: input.whatsapp,
        googleReviewUrl: input.googleReviewUrl,
        primaryColor: input.primaryColor,
      },
    });

    await tx.user.create({
      data: {
        clerkId,
        companyId: company.id,
        email,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    return company;
  });
}

/**
 * Motor de Ativação (Fase 18) — cria uma Company "casca" para um comprador
 * da loja física que nunca teve (e pode nunca vir a ter) uma conta no SaaS.
 * Sem `User`, sem assinatura real (`plan` fica em STARTER por padrão, mas
 * nunca é lido/cobrado para uma empresa GUEST — é `accountType` que marca
 * isso, não o plano). `googleReviewUrl` não tem sentido nenhum para um
 * convidado (não existe fluxo de avaliação por trás daquele cartão) —
 * recebe o próprio `destinationUrl` do pedido como placeholder inerte;
 * `services/store-order.service.ts` nunca deixa esse valor ser lido como
 * fallback de verdade, porque todo cartão GUEST sempre ganha uma
 * `CampaignAssignment` explícita no provisionamento.
 */
export async function createGuestCompany(params: { name: string; whatsapp: string; destinationUrl: string }) {
  const { name, whatsapp, destinationUrl } = params;
  const baseSlug = slugify(name, { fallback: "convidado" });
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.company.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  return prisma.company.create({
    data: {
      name,
      slug,
      whatsapp,
      googleReviewUrl: destinationUrl,
      accountType: "GUEST",
    },
  });
}

/**
 * Motor de Ativação (Fase 18) — upgrade de convidado para assinante sem
 * duplicar nada. Procura, pelo e-mail que está se cadastrando agora, um
 * `StoreOrder` já vinculado a uma `Company GUEST` — se encontrar, promove
 * essa MESMA empresa para CUSTOMER (preenchendo os campos reais de
 * onboarding por cima do que era só um placeholder) e cria o `User` OWNER
 * nela, em vez de `createCompanyForNewUser` criar uma empresa nova do zero.
 * Os cartões e o histórico de toques já existentes continuam sendo os
 * mesmos registros — nunca recriados. Retorna `null` quando não há nenhuma
 * empresa convidada para reivindicar (o caminho normal de um cadastro
 * totalmente novo).
 */
export async function claimGuestCompany(params: { clerkId: string; email: string; input: OnboardingInput }) {
  const { clerkId, email, input } = params;

  const guestOrder = await prisma.storeOrder.findFirst({
    where: { customerEmail: email, companyId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { companyId: true },
  });
  if (!guestOrder?.companyId) return null;

  const existing = await prisma.company.findUnique({ where: { id: guestOrder.companyId } });
  if (!existing || existing.accountType !== "GUEST") return null;

  const company = await prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({
      where: { id: existing.id },
      data: {
        accountType: "CUSTOMER",
        name: input.name,
        whatsapp: input.whatsapp,
        googleReviewUrl: input.googleReviewUrl,
        primaryColor: input.primaryColor,
      },
    });
    await tx.user.create({
      data: { clerkId, companyId: existing.id, email, role: "OWNER", status: "ACTIVE" },
    });
    return updated;
  });

  await invalidateCompany(company.id);
  return company;
}

/**
 * Fase 19.4 — todo dado que a ficha de empresa do Admin (CRM) precisa além
 * do que a página já busca (usuários/cartões/campanhas), numa função só,
 * para nunca divergir entre o Health Score e o heatmap sobre o que conta
 * como "atividade". `plan`/`createdAt` chegam de fora (a página já os tem
 * do `company.findUnique` principal) para não duplicar a query.
 */
export async function getCompanyOperationsSnapshot(
  companyId: string,
  company: { plan: keyof typeof PLANS; createdAt: Date }
) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    redirects30d,
    ratings30d,
    feedbacks30d,
    ratings90d,
    activeCampaigns,
    lastRedirect,
    lastRating,
    paidOrdersTotal,
    cardZones,
    recentRedirects,
    recentRatings,
  ] = await Promise.all([
    prisma.redirectLog.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.ratingEvent.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.privateFeedback.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.ratingEvent.findMany({ where: { companyId, createdAt: { gte: ninetyDaysAgo } }, select: { stars: true } }),
    prisma.campaign.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.redirectLog.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.ratingEvent.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.storeOrder.aggregate({
      where: { companyId, status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
      _sum: { amountTotalCents: true },
    }),
    prisma.nFCCard.findMany({ where: { companyId }, select: { id: true, zone: { select: { name: true } } } }),
    prisma.redirectLog.findMany({ where: { companyId, createdAt: { gte: sevenDaysAgo } }, select: { cardId: true, createdAt: true } }),
    prisma.ratingEvent.findMany({ where: { companyId, createdAt: { gte: sevenDaysAgo } }, select: { cardId: true, createdAt: true } }),
  ]);

  const eventsLast30Days = redirects30d + ratings30d + feedbacks30d;
  const ratingsTotal90Days = ratings90d.length;
  const ratingsPositive90Days = ratings90d.filter((r) => r.stars >= 4).length;

  const lastActivityAt = [lastRedirect?.createdAt, lastRating?.createdAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const daysSinceLastActivity = lastActivityAt ? Math.floor((now.getTime() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000)) : null;

  const monthsSinceCreated = Math.max(1, Math.floor((now.getTime() - company.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)));
  const physicalRevenueCents = paidOrdersTotal._sum.amountTotalCents ?? 0;
  const subscriptionRevenueEstimateCents = PLANS[company.plan].priceMonthly * 100 * monthsSinceCreated;

  const cardZoneList = cardZones.map((c) => ({ cardId: c.id, zoneName: c.zone?.name ?? null }));
  const activityEvents: ActivityEvent[] = [...recentRedirects, ...recentRatings];

  return {
    healthScoreInput: { eventsLast30Days, ratingsTotal90Days, ratingsPositive90Days, activeCampaigns, daysSinceLastActivity },
    revenue: { physicalRevenueCents, subscriptionRevenueEstimateCents, monthsSinceCreated },
    activityHeatmap: buildZoneActivityHeatmap(cardZoneList, activityEvents, now),
  };
}
