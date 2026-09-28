import type { PlanType } from "@/generated/prisma/client";

export interface PlanDefinition {
  id: PlanType;
  name: string;
  priceLabel: string;
  priceMonthly: number;
  cardLimit: number | null; // null = unlimited
  features: string[];
  highlighted?: boolean;
  /**
   * C15 — achado real de auditoria: os CTAs de Pro/Business na home levavam
   * a um checkout que responde 503 (`stripePriceIdForPlan` sem price id
   * configurado — planos congelados, sem venda ativa). Antes disso era só um
   * comentário; agora é dado tipado que a própria UI lê pra nunca prometer
   * um checkout que falha. `undefined`/`true` = à venda.
   */
  salesActive?: boolean;
}

export const PLANS: Record<PlanType, PlanDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceLabel: "R$39/mês",
    priceMonthly: 39,
    cardLimit: 1,
    // C10 (ADR-085) — "Retorno" faltava nesta lista desde que o recurso
    // existe (C5): quem olhava o preço via essa lista nunca via o motivo
    // real de assinar hoje ("Faça cada cliente voltar", BRAND.tagline desde
    // o C8). `highlighted` migrou de PRO pra cá na mesma revisão — Pulse
    // virou Starter First (Pro/Business congelados, só compatibilidade);
    // destacar o Pro contradizia a própria estratégia atual do produto.
    features: [
      "1 cartão NFC",
      "Retorno: brinde para o cliente voltar",
      "Redirecionamento para avaliação no Google",
      "Canal de feedback privado",
      "Central de ajuda (self-service)",
    ],
    highlighted: true,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceLabel: "R$89/mês",
    priceMonthly: 89,
    cardLimit: 10,
    salesActive: false,
    features: [
      "Até 10 cartões",
      "Retorno: brinde para o cliente voltar",
      "Campanhas customizadas",
      "Mapa de Mesas",
      "Analytics completo",
      "Exportação CSV",
      "Playbooks/automação",
      "Até 5 usuários na equipe",
      "Suporte por e-mail",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    priceLabel: "R$199/mês",
    priceMonthly: 199,
    cardLimit: null,
    salesActive: false,
    features: [
      "Cartões ilimitados",
      "Retorno: brinde para o cliente voltar",
      "Múltiplas unidades e zonas",
      "Equipe ilimitada",
      "Marca própria (domínio/login)",
      "API pública e Webhooks",
      "Suporte prioritário",
    ],
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

/**
 * Fase 20 — Entitlements por plano: até aqui, o único limite real era o de
 * cartões (`canCreateCard`) e uma única página travada na unha
 * (`dashboard/unidades`). Cada feature abaixo é um recurso que já existe no
 * produto e é liberado progressivamente por tier, espelhando o mesmo
 * espírito de `domain/rbac/roles.ts` (um `Record` explícito, nunca uma
 * hierarquia implícita "PRO inclui tudo do STARTER + X" que quebraria
 * silenciosamente se um plano precisar remover algo no futuro).
 */
export type PlanFeature =
  | "campaigns"
  | "table_map"
  | "analytics_full"
  | "csv_export"
  | "automation"
  | "multi_branch"
  | "white_label"
  | "api_access"
  // Pulse (ADR-078): o Retorno e a caixa de mensagens são o que o Starter vende.
  // Estão nos três planos: Pro e Business não perdem o que o Starter já entrega.
  | "return_offer"
  | "messages_inbox";

const PLAN_FEATURES: Record<PlanType, ReadonlySet<PlanFeature>> = {
  STARTER: new Set<PlanFeature>(["return_offer", "messages_inbox"]),
  PRO: new Set<PlanFeature>(["return_offer", "messages_inbox", "campaigns", "table_map", "analytics_full", "csv_export", "automation"]),
  BUSINESS: new Set<PlanFeature>([
    "return_offer",
    "messages_inbox",
    "campaigns",
    "table_map",
    "analytics_full",
    "csv_export",
    "automation",
    "multi_branch",
    "white_label",
    "api_access",
  ]),
};

export function planHasFeature(plan: PlanType, feature: PlanFeature): boolean {
  return PLAN_FEATURES[plan].has(feature);
}

const PLAN_ORDER: PlanType[] = ["STARTER", "PRO", "BUSINESS"];

/** O plano mais barato que já inclui `feature` — usado só para montar a
 * mensagem de upsell ("faz parte do plano X"), nunca para decidir acesso
 * (isso é sempre `planHasFeature`, direto contra o plano ATUAL da empresa). */
export function minimumPlanForFeature(feature: PlanFeature): PlanType {
  return PLAN_ORDER.find((plan) => planHasFeature(plan, feature)) ?? "BUSINESS";
}

/**
 * Starter é uso solo por desenho (empresa pequena, 1 unidade) — "equipe" só
 * existe a partir do Pro. `null` = sem limite (Business).
 */
export function teamLimitForPlan(plan: PlanType): number | null {
  if (plan === "STARTER") return 1;
  if (plan === "PRO") return 5;
  return null;
}

export function canInviteTeamMember(plan: PlanType, currentMemberCount: number): boolean {
  const limit = teamLimitForPlan(plan);
  if (limit === null) return true;
  return currentMemberCount < limit;
}

// Billing (Fase 15) — cada plano precisa de um Price object real criado no
// Stripe Dashboard (modo assinatura recorrente). O id do Price NÃO é
// inventado aqui: cada empresa que operar este produto cria seus próprios 3
// Prices no Stripe e aponta estas env vars para eles — nunca um valor
// hardcoded, já que o id de um Price é específico da conta Stripe de quem
// está rodando o produto.
const STRIPE_PRICE_ENV: Record<PlanType, string | undefined> = {
  STARTER: process.env.STRIPE_PRICE_STARTER,
  PRO: process.env.STRIPE_PRICE_PRO,
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
};

export function stripePriceIdForPlan(plan: PlanType): string | null {
  return STRIPE_PRICE_ENV[plan] ?? null;
}

/**
 * Corrige um buraco real (revisão de fluxo, 11/09/2026): antes desta
 * função, o webhook só escrevia `Company.plan` no momento da PRIMEIRA
 * assinatura — se o cliente trocasse de plano depois pelo próprio Portal de
 * Cobrança da Stripe (self-service, sem passar pelo checkout de novo), o
 * `subscription.status` continua "active" o tempo todo, então nada disparava
 * a atualização. O cliente pagava o valor novo e continuava preso nos
 * limites/features do plano antigo. Usado em `customer.subscription.updated`
 * para sempre refletir o Price atual da assinatura, não só o que foi
 * escolhido uma vez no início.
 */
export function planForStripePriceId(priceId: string): PlanType | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICE_ENV)) {
    if (id === priceId) return plan as PlanType;
  }
  return null;
}
