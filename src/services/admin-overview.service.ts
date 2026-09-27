import "server-only";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { stageEnteredAt, daysSince } from "@/domain/store-order/board";
import { buildAttentionRadar } from "@/domain/admin/attention-radar";
import { listStuckSupportRequests } from "@/services/support.service";
import type { InsightCardEntry } from "@nfc-os/ui";

const NEGATIVE_REVIEW_WINDOW_DAYS = 7;
const SUPPORT_REQUEST_STUCK_HOURS = 24;

export interface AdminOverviewSnapshot {
  revenue30dCents: number;
  disputedOrdersCount: number;
  activeProductionCount: number;
  stock: number;
  lowStockThreshold: number;
  activeCompanies: number;
  conversionRate: number | null;
  checkoutStarted: number;
  checkoutCompleted: number;
  radar: InsightCardEntry[];
}

/**
 * Fase 19.8 — extraído de `admin/page.tsx` (Fase 19.2) para o Modo
 * Executivo (`admin/executivo/page.tsx`) reaproveitar exatamente o mesmo
 * cálculo em vez de reimplementar as mesmas queries/regras de negócio numa
 * segunda tela — o próprio pedido do usuário ("Nenhuma duplicação").
 */
export async function getAdminOverviewSnapshot(): Promise<AdminOverviewSnapshot> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - NEGATIVE_REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const supportStuckSince = new Date(Date.now() - SUPPORT_REQUEST_STUCK_HOURS * 60 * 60 * 1000);

  const [allOrders, settings, activeCompanies, negativeReviewGroups, checkoutStarted, checkoutCompleted, stuckSupportRequests] =
    await Promise.all([
      prisma.storeOrder.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
      getSiteSettings(),
      prisma.company.count({ where: { accountType: "CUSTOMER" } }),
      prisma.ratingEvent.groupBy({
        by: ["companyId"],
        where: { stars: { lte: 2 }, createdAt: { gte: sevenDaysAgo } },
        _count: { _all: true },
        having: { companyId: { _count: { gte: 3 } } },
      }),
      prisma.storeOrder.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.storeOrder.count({ where: { createdAt: { gte: thirtyDaysAgo }, status: { not: "PENDING_PAYMENT" } } }),
      listStuckSupportRequests(supportStuckSince),
    ]);

  const negativeReviewCompanies = await Promise.all(
    negativeReviewGroups.map(async (g) => {
      const company = await prisma.company.findUnique({ where: { id: g.companyId }, select: { name: true } });
      return { companyId: g.companyId, companyName: company?.name ?? "Empresa removida", count: g._count._all };
    })
  );

  const stock = settings?.blankChipStock ?? 0;
  const lowStockThreshold = settings?.lowStockThreshold ?? 20;

  const activeProduction = allOrders.filter((o) => o.status === "PAID" || o.status === "SHIPPED");
  const disputedOrders = allOrders.filter((o) => o.disputeStatus && o.disputeStatus !== "won");
  const revenue30dCents = allOrders
    .filter((o) => o.status !== "PENDING_PAYMENT" && o.status !== "CANCELED" && o.createdAt >= thirtyDaysAgo)
    .reduce((sum, o) => sum + o.amountTotalCents - (o.refundAmountCents ?? 0), 0);

  const stuckOrders = activeProduction
    .map((o) => ({ id: o.id, customerName: o.customerName, daysStuck: daysSince(stageEnteredAt(o)) }))
    .filter((o) => o.daysStuck >= 3);

  const radar = buildAttentionRadar({
    stuckOrders,
    lowStock: { blankChipStock: stock, lowStockThreshold },
    disputedOrders: disputedOrders.map((o) => ({ id: o.id, customerName: o.customerName, disputeStatus: o.disputeStatus })),
    negativeReviewCompanies,
    stuckSupportRequests: stuckSupportRequests.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: r.company.name,
      subject: r.subject,
    })),
  }).map((insight) => {
    if (insight.id.startsWith("reviews:")) return { ...insight, href: `/admin/empresas/${insight.id.split(":")[1]}` };
    if (insight.id.startsWith("support:")) return { ...insight, href: `/admin/empresas/${insight.id.split(":")[1]}` };
    if (insight.id === "low-stock") return { ...insight, href: "/admin/conteudo" };
    return { ...insight, href: "/admin/pedidos" };
  });

  const conversionRate = checkoutStarted > 0 ? Math.round((checkoutCompleted / checkoutStarted) * 100) : null;

  return {
    revenue30dCents,
    disputedOrdersCount: disputedOrders.length,
    activeProductionCount: activeProduction.length,
    stock,
    lowStockThreshold,
    activeCompanies,
    conversionRate,
    checkoutStarted,
    checkoutCompleted,
    radar,
  };
}
