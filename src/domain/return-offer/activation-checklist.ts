/**
 * Checklist de ativação do Retorno (F5 do plano): o caminho de "nunca liguei"
 * até "já teve gente voltando", em passos que a Visão geral pode marcar como
 * feitos sem adivinhar nada — cada um vem de um dado real já buscado.
 */
export interface ActivationStep {
  id: "offer" | "pin" | "active" | "issued" | "redeemed";
  label: string;
  done: boolean;
}

export interface ActivationChecklistInput {
  offerExists: boolean;
  hasPin: boolean;
  active: boolean;
  issued: number;
  redeemed: number;
}

export function buildActivationChecklist(input: ActivationChecklistInput): ActivationStep[] {
  return [
    { id: "offer", label: "Escreva o brinde", done: input.offerExists },
    { id: "pin", label: "Defina o PIN da loja", done: input.hasPin },
    { id: "active", label: "Ative o Retorno", done: input.active },
    { id: "issued", label: "Alguém tocou e ganhou o primeiro brinde", done: input.issued > 0 },
    { id: "redeemed", label: "Alguém voltou e resgatou", done: input.redeemed > 0 },
  ];
}

/** Todo passo concluído — a Visão geral pode parar de mostrar o checklist. */
export function isActivationComplete(steps: ActivationStep[]): boolean {
  return steps.every((s) => s.done);
}
