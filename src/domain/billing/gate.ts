import type { AccessDecision } from "./effective-tier";

/**
 * Porteiro do painel (ADR-079). Decide para onde mandar quem não tem acesso e
 * que aviso mostrar a quem está em tolerância ou só leitura. Puro; a variável
 * de ambiente que liga a cobrança é lida por `lib/billing-gate.ts`.
 */

/**
 * Sem assinatura o painel não abre (D7). Só age com `enforced` ligado: em
 * desenvolvimento e antes do lançamento o painel continua aberto, para nenhum
 * teste nem cliente existente ser trancado por uma regra que ainda não entrou
 * em vigor.
 */
export function dashboardGateTarget(access: AccessDecision, enforced: boolean): "/onboarding/plan" | null {
  if (!enforced) return null;
  return access.canUseDashboard ? null : "/onboarding/plan";
}

export interface AccessNotice {
  tone: "warning" | "critical";
  title: string;
  description: string;
  /** C15 (Fluxo 6) — quando ausente, `AccessBanner` usa o link fixo padrão
   * ("Gerenciar assinatura" → Configurações/Portal). Só existe quando o
   * Portal de Cobrança NÃO resolve o problema (assinatura já cancelada/
   * `unpaid` de vez, não só um cartão pra atualizar). */
  cta?: { href: string; label: string };
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

const REACTIVATE_CTA = { href: "/onboarding/plan", label: "Reativar assinatura" };

/**
 * O aviso do topo do painel: só nos estados em que algo mudou para o dono.
 * `rawStatus` (C15) é o `stripeSubscriptionStatus` literal, não só o
 * `AccessState` derivado — é o que diferencia "cobrança atrasada, o Portal
 * resolve" de "assinatura já morta, só um novo checkout resolve" (o Portal
 * de Cobrança gerencia uma assinatura viva; não recria uma cancelada).
 */
export function accessNotice(access: AccessDecision, rawStatus: string | null): AccessNotice | null {
  if (access.state === "GRACE" && access.endsAt) {
    return {
      tone: "warning",
      title: "Não conseguimos cobrar a sua assinatura",
      description: `Atualize a forma de pagamento até ${dateLabel(access.endsAt)}. Depois disso o painel passa a só mostrar os dados, sem alterar nada.`,
    };
  }
  if (access.state === "READ_ONLY" && access.endsAt) {
    // GRACE só existe pra past_due/unpaid (ver resolveAccess); READ_ONLY
    // pode vir dos dois OU de canceled/paused (fim de assinatura de verdade)
    // — só nesse segundo caso o Portal não ajuda em nada.
    const stillHasLiveSubscription = rawStatus === "past_due" || rawStatus === "unpaid";
    return {
      tone: "critical",
      title: "Assinatura inativa: painel só para consulta",
      description: `Você vê seus dados, mas não altera nada nem emite brindes novos. Os brindes já emitidos continuam valendo. Reative até ${dateLabel(access.endsAt)} para não perder o acesso.`,
      cta: stillHasLiveSubscription ? undefined : REACTIVATE_CTA,
    };
  }
  return null;
}
