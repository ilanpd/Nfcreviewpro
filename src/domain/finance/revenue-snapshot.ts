import { PLANS } from "@/lib/plans";
import type { PlanType } from "@/generated/prisma/client";

/**
 * Fase 19.6 — MRR/ARR são sempre o snapshot de HOJE, nunca uma série
 * histórica: `Company` só guarda o plano atual, não quando cada troca
 * aconteceu antes do evento `PlanoAlterado` (ver `event-bus`) começar a
 * registrar isso. Função pura: recebe empresas já buscadas (nunca busca
 * sozinha), soma o preço do plano só de quem tem assinatura Stripe
 * realmente `"active"` — uma empresa `past_due`/`canceled`/sem assinatura
 * nunca entra no MRR, mesmo continuando com um `plan` atribuído.
 */

export interface RevenueSnapshotCompany {
  plan: PlanType;
  stripeSubscriptionStatus: string | null;
}

export interface PlanDistributionEntry {
  plan: PlanType;
  companyCount: number;
}

export interface RevenueSnapshot {
  mrrCents: number;
  arrCents: number;
  payingCompanyCount: number;
  totalCustomerCount: number;
  planDistribution: PlanDistributionEntry[];
}

export function computeRevenueSnapshot(companies: RevenueSnapshotCompany[]): RevenueSnapshot {
  const payingCompanies = companies.filter((c) => c.stripeSubscriptionStatus === "active");
  const mrrCents = payingCompanies.reduce((sum, c) => sum + PLANS[c.plan].priceMonthly * 100, 0);

  const counts = new Map<PlanType, number>();
  for (const c of payingCompanies) counts.set(c.plan, (counts.get(c.plan) ?? 0) + 1);

  const planDistribution = (Object.keys(PLANS) as PlanType[])
    .map((plan) => ({ plan, companyCount: counts.get(plan) ?? 0 }))
    .filter((entry) => entry.companyCount > 0)
    .sort((a, b) => b.companyCount - a.companyCount);

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    payingCompanyCount: payingCompanies.length,
    totalCustomerCount: companies.length,
    planDistribution,
  };
}
