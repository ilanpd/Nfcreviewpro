import "server-only";
import { prisma } from "@/lib/prisma";
import { computeRevenueSnapshot, type RevenueSnapshot } from "@/domain/finance/revenue-snapshot";

export interface FinanceSnapshot {
  revenue: RevenueSnapshot;
  physicalRevenue30dCents: number;
  physicalRevenue90dCents: number;
}

/**
 * Fase 19.8 — extraído de `admin/financeiro/page.tsx` (Fase 19.6) para o
 * Modo Executivo reaproveitar o mesmo snapshot financeiro em vez de
 * refazer as mesmas queries numa segunda tela.
 */
export async function getFinanceSnapshot(): Promise<FinanceSnapshot> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [customerCompanies, physicalOrders] = await Promise.all([
    prisma.company.findMany({
      where: { accountType: "CUSTOMER" },
      select: { plan: true, stripeSubscriptionStatus: true },
    }),
    prisma.storeOrder.findMany({
      where: { status: { notIn: ["PENDING_PAYMENT", "CANCELED"] }, createdAt: { gte: ninetyDaysAgo } },
      select: { amountTotalCents: true, refundAmountCents: true, createdAt: true },
    }),
  ]);

  const revenue = computeRevenueSnapshot(customerCompanies);
  const physicalRevenue90dCents = physicalOrders.reduce((sum, o) => sum + o.amountTotalCents - (o.refundAmountCents ?? 0), 0);
  const physicalRevenue30dCents = physicalOrders
    .filter((o) => o.createdAt >= thirtyDaysAgo)
    .reduce((sum, o) => sum + o.amountTotalCents - (o.refundAmountCents ?? 0), 0);

  return { revenue, physicalRevenue30dCents, physicalRevenue90dCents };
}
