/**
 * Acesso efetivo de uma empresa (ADR-079). Uma função só decide o que a
 * empresa pode usar agora, a partir do tipo de conta e do estado da assinatura
 * no Stripe. Antes dela, o painel abria sem checar assinatura e cancelar
 * deixava a empresa no plano que já estava gravado.
 *
 * Política (D7 do plano): painel só com assinatura; 7 dias de tolerância
 * depois de uma cobrança atrasada; 90 dias só de leitura antes de bloquear.
 * Puro: recebe o que já foi buscado; nunca lê banco nem relógio.
 */

export type AccessState =
  /** Sem assinatura (cartão avulso, ou cadastro sem pagar): sem painel. */
  | "NONE"
  /** Assinatura em dia. */
  | "ACTIVE"
  /** Cobrança atrasada, ainda dentro da tolerância: tudo funciona, com aviso. */
  | "GRACE"
  /** Assinatura cancelada ou atraso além da tolerância: o dono vê os dados, mas não muda nada nem emite brinde novo. */
  | "READ_ONLY"
  /** Passou o período de leitura: só reativando. */
  | "LAPSED";

export const GRACE_DAYS = 7;
export const READ_ONLY_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

type PlanValue = "STARTER" | "PRO" | "BUSINESS";

export interface AccessInput {
  accountType: "GUEST" | "CUSTOMER";
  plan: PlanValue;
  /** `status` do Subscription do Stripe, literal (nulo antes do primeiro checkout). */
  stripeSubscriptionStatus: string | null;
  /** Quando o status mudou pela última vez (só o webhook escreve). Nulo em linhas antigas. */
  subscriptionStatusChangedAt: Date | null;
  now: Date;
}

export interface AccessDecision {
  state: AccessState;
  /** Plano cujos recursos valem agora; nulo quando não há acesso ao painel. */
  effectivePlan: PlanValue | null;
  canUseDashboard: boolean;
  /** Pode alterar dados do painel. */
  canWrite: boolean;
  /** Pode emitir brinde novo (resgatar brinde já emitido é sempre permitido: é uma promessa feita ao cliente). */
  canIssueVouchers: boolean;
  /** Quando o estado atual acaba (fim da tolerância ou da leitura), para o aviso do painel. */
  endsAt: Date | null;
}

const NO_ACCESS: AccessDecision = {
  state: "NONE",
  effectivePlan: null,
  canUseDashboard: false,
  canWrite: false,
  canIssueVouchers: false,
  endsAt: null,
};

function decision(state: AccessState, plan: PlanValue, endsAt: Date | null): AccessDecision {
  switch (state) {
    case "ACTIVE":
    case "GRACE":
      return { state, effectivePlan: plan, canUseDashboard: true, canWrite: true, canIssueVouchers: true, endsAt };
    case "READ_ONLY":
      return { state, effectivePlan: plan, canUseDashboard: true, canWrite: false, canIssueVouchers: false, endsAt };
    case "LAPSED":
      return { state, effectivePlan: null, canUseDashboard: false, canWrite: false, canIssueVouchers: false, endsAt: null };
    case "NONE":
      return NO_ACCESS;
  }
}

export function resolveAccess(input: AccessInput): AccessDecision {
  if (input.accountType === "GUEST") return NO_ACCESS;

  const status = input.stripeSubscriptionStatus;
  if (status === null || status === "incomplete" || status === "incomplete_expired") return NO_ACCESS;
  if (status === "active" || status === "trialing") return decision("ACTIVE", input.plan, null);

  // Sem data da mudança (linhas anteriores a esta regra) o relógio começa agora:
  // nunca bloqueia quem já paga por falta de um dado que não existia.
  const since = input.subscriptionStatusChangedAt ?? input.now;

  if (status === "past_due" || status === "unpaid") {
    const graceEnd = new Date(since.getTime() + GRACE_DAYS * DAY_MS);
    if (input.now < graceEnd) return decision("GRACE", input.plan, graceEnd);
    const readOnlyEnd = new Date(graceEnd.getTime() + READ_ONLY_DAYS * DAY_MS);
    return input.now < readOnlyEnd ? decision("READ_ONLY", input.plan, readOnlyEnd) : decision("LAPSED", input.plan, null);
  }

  // "canceled", "paused" e qualquer estado que o Stripe venha a criar: leitura
  // por 90 dias. Errar para o lado da leitura nunca deixa um cliente pagante trancado do lado de fora.
  const readOnlyEnd = new Date(since.getTime() + READ_ONLY_DAYS * DAY_MS);
  return input.now < readOnlyEnd ? decision("READ_ONLY", input.plan, readOnlyEnd) : decision("LAPSED", input.plan, null);
}
