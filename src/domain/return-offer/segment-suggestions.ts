/**
 * Brindes sugeridos por segmento (decisão D5 do plano): "uma lista curta
 * pronta... para o dono escolher em um toque, em vez de inventar". Puro —
 * a tela só mostra os botões e preenche o formulário do brinde ao clicar.
 * Preços/custos ficam de fora de propósito: quem decide o que cabe na
 * margem é sempre o dono, nunca uma sugestão automática de valor.
 */
export interface RewardSuggestion {
  segment: string;
  title: string;
  description: string;
}

export const REWARD_SUGGESTIONS: RewardSuggestion[] = [
  { segment: "Barbearia", title: "Hidratação grátis", description: "Na próxima visita, sem custo." },
  { segment: "Restaurante", title: "Sobremesa por conta da casa", description: "Uma sobremesa do cardápio, cortesia da casa." },
  { segment: "Pet shop", title: "Banho grátis", description: "Um banho simples, sem custo, na próxima visita." },
  { segment: "Salão", title: "Escova grátis", description: "Uma escova, cortesia da casa, na próxima visita." },
  { segment: "Loja", title: "10% de desconto", description: "10% de desconto na próxima compra." },
];
