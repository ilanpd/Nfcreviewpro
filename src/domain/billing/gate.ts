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
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/** O aviso do topo do painel: só nos estados em que algo mudou para o dono. */
export function accessNotice(access: AccessDecision): AccessNotice | null {
  if (access.state === "GRACE" && access.endsAt) {
    return {
      tone: "warning",
      title: "Não conseguimos cobrar a sua assinatura",
      description: `Atualize a forma de pagamento até ${dateLabel(access.endsAt)}. Depois disso o painel passa a só mostrar os dados, sem alterar nada.`,
    };
  }
  if (access.state === "READ_ONLY" && access.endsAt) {
    return {
      tone: "critical",
      title: "Assinatura inativa: painel só para consulta",
      description: `Você vê seus dados, mas não altera nada nem emite brindes novos. Os brindes já emitidos continuam valendo. Reative até ${dateLabel(access.endsAt)} para não perder o acesso.`,
    };
  }
  return null;
}
