import type { PlanType } from "@/generated/prisma/client";

export interface PlanDefinition {
  id: PlanType;
  name: string;
  priceLabel: string;
  priceMonthly: number;
  cardLimit: number | null; // null = unlimited
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Record<PlanType, PlanDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceLabel: "R$39/mês",
    priceMonthly: 39,
    cardLimit: 1,
    features: ["1 cartão NFC", "Dashboard básico", "Link de avaliação Google", "Canal de feedback privado"],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceLabel: "R$89/mês",
    priceMonthly: 89,
    cardLimit: 10,
    features: ["Até 10 cartões", "Analytics completo", "Gestão de equipe", "Exportação CSV", "Tags por cartão"],
    highlighted: true,
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    priceLabel: "R$199/mês",
    priceMonthly: 199,
    cardLimit: null,
    features: ["Cartões ilimitados", "Múltiplas unidades (em breve)", "Domínio personalizado (em breve)", "Suporte prioritário"],
  },
};

export function cardLimitForPlan(plan: PlanType): number | null {
  return PLANS[plan].cardLimit;
}

export function canCreateCard(plan: PlanType, currentCardCount: number): boolean {
  const limit = cardLimitForPlan(plan);
  if (limit === null) return true;
  return currentCardCount < limit;
}
