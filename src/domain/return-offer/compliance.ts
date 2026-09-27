/**
 * O brinde nunca pode ser condicionado a avaliar (ADR-078). A política do Google
 * proíbe oferecer benefício em troca de avaliação, e o texto do brinde é livre
 * (o dono escreve). Esta é a trava no servidor: recusa um título ou descrição
 * que cite avaliação, Google ou estrelas. Não substitui o treinamento da
 * equipe ("nunca dizer avalie e ganhe"), mas impede que o próprio sistema
 * imprima a promessa na tela do cliente.
 */

const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: "avaliação", pattern: /avali/i },
  { label: "review", pattern: /\breviews?\b/i },
  { label: "Google", pattern: /\bgoogle\b/i },
  { label: "estrelas", pattern: /\bestrelas?\b|\bstars?\b/i },
  { label: "nota", pattern: /\bnota\s+(5|10|m[aá]xima)\b|\bdê\s+nota\b|\bdar\s+nota\b/i },
  { label: "comentar/elogiar", pattern: /\b(comente|comentar|elogie|elogiar|recomende|recomendar)\b/i },
];

/** O primeiro termo proibido encontrado no texto, ou `null` se estiver limpo. */
export function findForbiddenRewardTerm(text: string): string | null {
  for (const { label, pattern } of FORBIDDEN) {
    if (pattern.test(text)) return label;
  }
  return null;
}

export function forbiddenRewardMessage(term: string): string {
  return `O brinde não pode citar ${term}: oferecer benefício por avaliação é proibido pelo Google. Descreva só o que o cliente ganha.`;
}
