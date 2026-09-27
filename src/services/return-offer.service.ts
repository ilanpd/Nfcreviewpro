import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, type AuthContext } from "@/lib/auth";
import { recordAudit } from "@/services/audit.service";
import { getSiteSettings } from "@/lib/site-settings";
import { publishEvent } from "@/lib/event-bus";
import { planHasFeature } from "@/lib/plans";
import { resolveAccess, type AccessDecision } from "@/domain/billing/effective-tier";
import { offerAvailability, type OfferAvailability } from "@/domain/return-offer/availability";
import { normalizeVoucherCode } from "@/domain/return-offer/code";
import { explainRedeemFailure, type RedeemFailure } from "@/domain/return-offer/lifecycle";
import { evaluatePinAttempts, isWeakPin } from "@/domain/return-offer/pin";
import { formatDayMonth } from "@/domain/return-offer/time";
import { toPublicVoucherView, type PublicVoucherView, type ReturnTouchView } from "@/domain/return-offer/view";
import { hashPin, verifyPin } from "@/lib/return-offer/pin-hash";
import { addPinFailure, clearPinFailures, getPinFailures } from "@/lib/return-offer/pin-failures";
import { redeemVoucherAtomically } from "@/lib/return-offer/store";
import { issueOrShowVoucher } from "@/lib/return-offer/touch";
import type { OfferInput } from "@/lib/validations/return-offer";
import type { RewardOffer, VoucherStatus } from "@/generated/prisma/client";

/**
 * Serviço do Retorno (ADR-079): toque que emite brinde, consulta e resgate
 * públicos, e a gestão do dono. As decisões de regra vêm de `domain/return-offer`
 * (puro); aqui ficam o banco, o Redis, os eventos e a auditoria.
 */

export class ReturnOfferError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ReturnOfferError";
  }
}

// Falhas de PIN por empresa: mais folgado que o limite por brinde, para uma
// atendente que erra o PIN não travar a loja, mas apertado o bastante para
// impedir a busca de PIN em milhares de códigos.
const COMPANY_PIN_FAILURES = 20;

// --- contexto ---------------------------------------------------------------

export interface ReturnContext {
  company: {
    id: string;
    name: string;
    plan: "STARTER" | "PRO" | "BUSINESS";
    timezone: string;
    googleReviewUrl: string;
    returnPilotEnabled: boolean;
  };
  offer: RewardOffer | null;
  access: AccessDecision;
  globalEnabled: boolean;
  availability: OfferAvailability;
}

/** Tudo o que decide se o Retorno está de pé para uma empresa, numa consulta só. */
export async function loadReturnContext(companyId: string, now = new Date()): Promise<ReturnContext | null> {
  const [company, settings] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        plan: true,
        accountType: true,
        stripeSubscriptionStatus: true,
        subscriptionStatusChangedAt: true,
        returnPilotEnabled: true,
        timezone: true,
        googleReviewUrl: true,
        rewardOffer: true,
      },
    }),
    getSiteSettings(),
  ]);
  if (!company) return null;

  const access = resolveAccess({
    accountType: company.accountType,
    plan: company.plan,
    stripeSubscriptionStatus: company.stripeSubscriptionStatus,
    subscriptionStatusChangedAt: company.subscriptionStatusChangedAt,
    now,
  });
  const globalEnabled = settings?.returnOfferEnabled ?? true;
  const offer = company.rewardOffer;
  const availability = offerAvailability({
    globalEnabled,
    pilotEnabled: company.returnPilotEnabled,
    tierAllowsReturn: access.canIssueVouchers && !!access.effectivePlan && planHasFeature(access.effectivePlan, "return_offer"),
    offerActive: offer?.active ?? false,
    hasPin: !!offer?.pinHash,
  });

  return {
    company: {
      id: company.id,
      name: company.name,
      plan: company.plan,
      timezone: company.timezone,
      googleReviewUrl: company.googleReviewUrl,
      returnPilotEnabled: company.returnPilotEnabled,
    },
    offer,
    access,
    globalEnabled,
    availability,
  };
}

// --- toque -------------------------------------------------------------------

/**
 * O que acontece quando um aparelho toca no cartão de uma empresa com o Retorno
 * de pé: emite um brinde, mostra o que já existe ou explica a espera. Devolve
 * `null` quando o Retorno não está disponível, e o cartão se comporta como
 * antes. Nunca lança por regra de negócio: quem chama trata falha como "sem
 * brinde", porque o caminho do cliente até o Google nunca depende disto.
 *
 * O aparelho é serializado por um lock de transação do Postgres: dois toques
 * simultâneos do mesmo cookie (duplo clique, duas abas) não emitem dois brindes.
 */
export async function touchReturn(input: {
  companyId: string;
  cardId: string;
  visitId: string;
  visitorId: string;
  now?: Date;
  /** Contexto já carregado por quem chama (evita repetir as consultas). */
  context?: ReturnContext | null;
}): Promise<ReturnTouchView | null> {
  const now = input.now ?? new Date();
  const ctx = input.context !== undefined ? input.context : await loadReturnContext(input.companyId, now);
  if (!ctx || !ctx.availability.available || !ctx.offer) return null;
  const { offer, company } = ctx;
  const tz = company.timezone;

  const outcome = await issueOrShowVoucher(prisma, {
    company: { id: company.id, timezone: tz },
    offer,
    cardId: input.cardId,
    visitId: input.visitId,
    visitorId: input.visitorId,
    now,
  });

  switch (outcome.kind) {
    case "ISSUED":
      after(() => {
        publishEvent(
          "BrindeEmitido",
          { voucherId: outcome.voucher.id, cardId: input.cardId, windowDays: offer.windowDays },
          { companyId: company.id }
        ).catch((err) => console.error("[return] publish BrindeEmitido failed", err));
      });
      return { state: "ISSUED", voucher: toPublicVoucherView(outcome.voucher, tz, now) };
    case "EXISTING":
      return { state: "EXISTING", voucher: toPublicVoucherView(outcome.voucher, tz, now) };
    case "COOLDOWN":
      return {
        state: "COOLDOWN",
        nextEligibleLabel: formatDayMonth(outcome.nextEligibleAt, tz),
        lastStatus: outcome.lastStatus === "VOIDED" ? "EXPIRED" : outcome.lastStatus,
      };
    case "CAP_REACHED":
      return { state: "CAP_REACHED" };
  }
}

// --- consulta e resgate públicos --------------------------------------------

async function companyForCard(cardCode: string) {
  const card = await prisma.nFCCard.findFirst({
    where: { uniqueCode: cardCode, active: true },
    select: { id: true, companyId: true, company: { select: { timezone: true } } },
  });
  return card;
}

export type LookupResult = { ok: true; voucher: PublicVoucherView } | { ok: false; reason: "NOT_FOUND" };

/**
 * O cliente digitou o código de um brinde (outro celular, ou sem cookie) e quer
 * ver o estado dele. Não pede PIN: o código já é a credencial do cliente. Quem
 * não tem o código não tem o que ver, e a tentativa em massa é barrada pelo
 * limite de taxa da rota.
 */
export async function lookupVoucher(input: { cardCode: string; code: string; now?: Date }): Promise<LookupResult> {
  const now = input.now ?? new Date();
  const code = normalizeVoucherCode(input.code);
  if (!code) return { ok: false, reason: "NOT_FOUND" };
  const card = await companyForCard(input.cardCode);
  if (!card) return { ok: false, reason: "NOT_FOUND" };

  const voucher = await prisma.voucher.findUnique({
    where: { companyId_code: { companyId: card.companyId, code } },
    select: { code: true, title: true, status: true, availableAt: true, expiresAt: true },
  });
  if (!voucher) return { ok: false, reason: "NOT_FOUND" };
  return { ok: true, voucher: toPublicVoucherView(voucher, card.company.timezone, now) };
}

export type RedeemResult =
  | { ok: true; title: string }
  | { ok: false; reason: "UNAVAILABLE" | "NOT_FOUND" | RedeemFailure }
  | { ok: false; reason: "WRONG_PIN"; remainingAttempts: number }
  | { ok: false; reason: "TOO_MANY_ATTEMPTS"; retryAt: string };

/**
 * Resgate: código do brinde + PIN da loja, digitados na tela do cliente com o
 * atendente ao lado. Ordem: existência do brinde, limite de tentativas, PIN,
 * resgate atômico. O resgate continua permitido depois de cancelar a
 * assinatura ou pausar o brinde: é uma promessa já feita ao cliente. Só o
 * interruptor geral o interrompe.
 */
export async function redeemVoucher(input: { cardCode: string; code: string; pin: string; now?: Date }): Promise<RedeemResult> {
  const now = input.now ?? new Date();
  const code = normalizeVoucherCode(input.code);
  const card = await companyForCard(input.cardCode);
  if (!code || !card) return { ok: false, reason: "NOT_FOUND" };
  const companyId = card.companyId;

  const settings = await getSiteSettings();
  if (settings && !settings.returnOfferEnabled) return { ok: false, reason: "UNAVAILABLE" };

  const companyScope = `company:${companyId}`;
  const companyGate = evaluatePinAttempts({
    failures: await getPinFailures(companyScope, now),
    now,
    maxFailures: COMPANY_PIN_FAILURES,
  });
  if (!companyGate.allowed) return { ok: false, reason: "TOO_MANY_ATTEMPTS", retryAt: companyGate.retryAt.toISOString() };

  const voucher = await prisma.voucher.findUnique({
    where: { companyId_code: { companyId, code } },
    select: { id: true, title: true, status: true, availableAt: true, expiresAt: true, offer: { select: { pinHash: true } } },
  });
  if (!voucher) {
    await addPinFailure(companyScope, now);
    return { ok: false, reason: "NOT_FOUND" };
  }

  const voucherScope = `voucher:${voucher.id}`;
  const voucherGate = evaluatePinAttempts({ failures: await getPinFailures(voucherScope, now), now });
  if (!voucherGate.allowed) return { ok: false, reason: "TOO_MANY_ATTEMPTS", retryAt: voucherGate.retryAt.toISOString() };

  if (!verifyPin(input.pin, voucher.offer.pinHash)) {
    await Promise.all([addPinFailure(voucherScope, now), addPinFailure(companyScope, now)]);
    const remaining = evaluatePinAttempts({ failures: await getPinFailures(voucherScope, now), now });
    return { ok: false, reason: "WRONG_PIN", remainingAttempts: remaining.allowed ? remaining.remaining : 0 };
  }

  const redeemed = await redeemVoucherAtomically(prisma, voucher.id, now);
  if (!redeemed) {
    // Não passou: descobre o motivo relendo o estado atual (outro resgate pode
    // ter ganho a corrida, ou o brinde pode ter vencido nesse meio tempo).
    const fresh = await prisma.voucher.findUnique({
      where: { id: voucher.id },
      select: { status: true, availableAt: true, expiresAt: true },
    });
    const reason = explainRedeemFailure(fresh, now);
    return { ok: false, reason: reason ?? "ALREADY_REDEEMED" };
  }

  await clearPinFailures(voucherScope);
  const full = await prisma.voucher.findUnique({ where: { id: voucher.id }, select: { cardId: true, issuedAt: true } });
  after(() => {
    publishEvent(
      "BrindeResgatado",
      { voucherId: voucher.id, cardId: full?.cardId ?? null, issuedAt: (full?.issuedAt ?? now).toISOString() },
      { companyId }
    ).catch((err) => console.error("[return] publish BrindeResgatado failed", err));
  });
  return { ok: true, title: voucher.title };
}

// --- gestão do dono ---------------------------------------------------------

/** O que o painel mostra da configuração. Nunca o hash do PIN, só se existe. */
export interface OfferSettingsView {
  offer: {
    title: string;
    description: string | null;
    windowDays: number;
    cooldownDays: number;
    dailyCap: number | null;
    primaryUrl: string | null;
    active: boolean;
    hasPin: boolean;
  } | null;
  availability: OfferAvailability;
  access: Pick<AccessDecision, "state" | "canWrite" | "endsAt">;
  googleReviewUrl: string;
  pilotEnabled: boolean;
}

export async function getOfferSettings(companyId: string): Promise<OfferSettingsView> {
  const ctx = await loadReturnContext(companyId);
  if (!ctx) throw new ReturnOfferError("Empresa não encontrada", 404);
  const { offer } = ctx;
  return {
    offer: offer
      ? {
          title: offer.title,
          description: offer.description,
          windowDays: offer.windowDays,
          cooldownDays: offer.cooldownDays,
          dailyCap: offer.dailyCap,
          primaryUrl: offer.primaryUrl,
          active: offer.active,
          hasPin: !!offer.pinHash,
        }
      : null,
    availability: ctx.availability,
    access: { state: ctx.access.state, canWrite: ctx.access.canWrite, endsAt: ctx.access.endsAt },
    googleReviewUrl: ctx.company.googleReviewUrl,
    pilotEnabled: ctx.company.returnPilotEnabled,
  };
}

function requireWriteAccess(ctx: ReturnContext) {
  if (!ctx.access.canWrite) {
    throw new ReturnOfferError("A assinatura não está ativa. Reative para alterar o brinde.", 402);
  }
}

export async function saveOffer(auth: AuthContext, input: OfferInput) {
  const ctx = await loadReturnContext(auth.companyId);
  if (!ctx) throw new ReturnOfferError("Empresa não encontrada", 404);
  requireWriteAccess(ctx);
  if (input.active && !ctx.offer?.pinHash) {
    throw new ReturnOfferError("Defina o PIN da loja antes de ativar o brinde.", 422);
  }

  const data = {
    title: input.title,
    description: input.description ?? null,
    windowDays: input.windowDays,
    cooldownDays: input.cooldownDays,
    dailyCap: input.dailyCap ?? null,
    primaryUrl: input.primaryUrl ?? null,
    active: input.active,
  };
  const offer = await prisma.rewardOffer.upsert({
    where: { companyId: auth.companyId },
    create: { companyId: auth.companyId, ...data },
    update: data,
  });
  await recordAudit(auth, "REWARD_OFFER_UPDATED", {
    targetId: offer.id,
    metadata: { active: offer.active, windowDays: offer.windowDays, cooldownDays: offer.cooldownDays, dailyCap: offer.dailyCap },
  });
  return offer;
}

/** Troca o PIN. O valor nunca vai para o log de auditoria, só o fato da troca. */
export async function changePin(auth: AuthContext, pin: string) {
  const ctx = await loadReturnContext(auth.companyId);
  if (!ctx) throw new ReturnOfferError("Empresa não encontrada", 404);
  requireWriteAccess(ctx);
  if (!ctx.offer) throw new ReturnOfferError("Configure o brinde antes de definir o PIN.", 422);
  if (isWeakPin(pin)) throw new ReturnOfferError("PIN fácil demais. Escolha outro.", 422);

  await prisma.rewardOffer.update({
    where: { id: ctx.offer.id },
    data: { pinHash: hashPin(pin), pinUpdatedAt: new Date() },
  });
  await recordAudit(auth, "REWARD_PIN_CHANGED", { targetId: ctx.offer.id });
}

export async function listVouchers(companyId: string, options: { status?: VoucherStatus; take?: number } = {}) {
  const rows = await prisma.voucher.findMany({
    where: { companyId, ...(options.status ? { status: options.status } : {}) },
    orderBy: { issuedAt: "desc" },
    take: options.take ?? 50,
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      issuedAt: true,
      availableAt: true,
      expiresAt: true,
      redeemedAt: true,
      voidedReason: true,
      card: { select: { name: true } },
    },
  });
  const now = new Date();
  return rows.map((row) => ({ ...row, isExpiredNow: row.status === "ISSUED" && row.expiresAt <= now }));
}

export async function voidVoucher(auth: AuthContext, voucherId: string, reason: string) {
  const ctx = await loadReturnContext(auth.companyId);
  if (!ctx) throw new ReturnOfferError("Empresa não encontrada", 404);
  requireWriteAccess(ctx);

  const { count } = await prisma.voucher.updateMany({
    where: { id: voucherId, companyId: auth.companyId, status: { in: ["ISSUED", "REDEEMED"] } },
    data: { status: "VOIDED", voidedAt: new Date(), voidedReason: reason },
  });
  if (count === 0) throw new ForbiddenError("Brinde não encontrado nesta empresa ou já anulado");

  await recordAudit(auth, "VOUCHER_VOIDED", { targetId: voucherId, metadata: { reason } });
  after(() => {
    publishEvent("BrindeAnulado", { voucherId, reason }, { companyId: auth.companyId }).catch((err) =>
      console.error("[return] publish BrindeAnulado failed", err)
    );
  });
}

export interface ReturnSummary {
  days: number;
  /** Toques na tela do Retorno (uma visita por toque). */
  taps: number;
  issued: number;
  redeemed: number;
  /** Brindes emitidos, ainda dentro da validade e não resgatados: o passivo em aberto do dono. */
  openNow: number;
  recentRedemptions: { title: string; redeemedAt: string }[];
}

/** Os três números do painel do Starter, mais o passivo em aberto. */
export async function getReturnSummary(companyId: string, days = 30): Promise<ReturnSummary> {
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const [taps, issued, redeemed, openNow, recent] = await Promise.all([
    prisma.visit.count({ where: { companyId, createdAt: { gte: since } } }),
    prisma.voucher.count({ where: { companyId, issuedAt: { gte: since } } }),
    prisma.voucher.count({ where: { companyId, status: "REDEEMED", redeemedAt: { gte: since } } }),
    prisma.voucher.count({ where: { companyId, status: "ISSUED", expiresAt: { gt: now } } }),
    prisma.voucher.findMany({
      where: { companyId, status: "REDEEMED", redeemedAt: { not: null } },
      orderBy: { redeemedAt: "desc" },
      take: 5,
      select: { title: true, redeemedAt: true },
    }),
  ]);
  return {
    days,
    taps,
    issued,
    redeemed,
    openNow,
    recentRedemptions: recent.map((r) => ({ title: r.title, redeemedAt: r.redeemedAt!.toISOString() })),
  };
}

// --- Admin ------------------------------------------------------------------

/** Libera ou bloqueia o Retorno para uma empresa (piloto). Só o Admin chama. */
export async function setReturnPilot(adminEmail: string, companyId: string, enabled: boolean) {
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { returnPilotEnabled: enabled },
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: { companyId: company.id, userId: null, action: "RETURN_PILOT_CHANGED", metadata: { enabled, by: adminEmail } },
  });
}

/** Interruptor geral: falso desliga emissão e resgate para todas as empresas, na hora. */
export async function setReturnKillSwitch(adminEmail: string, enabled: boolean) {
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", returnOfferEnabled: enabled, updatedByEmail: adminEmail },
    update: { returnOfferEnabled: enabled, updatedByEmail: adminEmail },
  });
}

