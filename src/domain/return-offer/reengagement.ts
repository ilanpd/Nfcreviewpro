/**
 * Reengajamento D+7/D+30 do Retorno (C9/F6, ADR-084, J7 do plano). Função
 * pura: decide se uma empresa está devendo um lembrete hoje, sem tocar em
 * banco, Stripe ou relógio — quem chama (`services/return-offer.service.ts`
 * + a rota de cron) já buscou tudo isso.
 *
 * Regra: nunca incomoda quem já ativou o Retorno; nunca incomoda quem não
 * tem acesso de escrita agora (pedir pra ativar algo que a pessoa não pode
 * mudar não ajuda ninguém); e, uma vez mandado o lembrete final (D30), nunca
 * manda o D7 depois — evita a ordem estranha de "seu primeiro lembrete" três
 * semanas depois do "último lembrete".
 */

export type ReengagementMilestone = "D7" | "D30";

export interface ReengagementInput {
  createdAt: Date;
  returnOfferActive: boolean;
  canWrite: boolean;
  reengagementD7EmailSentAt: Date | null;
  reengagementD30EmailSentAt: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function dueReengagementMilestone(input: ReengagementInput, now: Date): ReengagementMilestone | null {
  if (input.returnOfferActive) return null;
  if (!input.canWrite) return null;
  if (input.reengagementD30EmailSentAt) return null;

  const daysSinceSignup = Math.floor((now.getTime() - input.createdAt.getTime()) / DAY_MS);
  if (daysSinceSignup >= 30) return "D30";
  if (daysSinceSignup >= 7 && !input.reengagementD7EmailSentAt) return "D7";
  return null;
}
