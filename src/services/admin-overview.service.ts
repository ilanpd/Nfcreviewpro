import "server-only";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { BOARD_COLUMNS, deriveBoardColumn, stageEnteredAt, daysSince, type BoardColumn } from "@/domain/store-order/board";
import { buildAttentionRadar } from "@/domain/admin/attention-radar";
import { listStuckSupportRequests } from "@/services/support.service";
import { getCardUrlGuard } from "@/lib/card-url";
import { getRadarPlateInputs, getStockSummary, type RadarPlateInputs } from "@/services/plates.service";
import { resend } from "@/lib/email";
import type { InsightCardEntry } from "@nfc-os/ui";

const UNRESOLVED_FEEDBACK_WINDOW_DAYS = 7;
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
  /** Quantos pedidos há em cada etapa de produção e quantos estão parados (3+ dias). */
  stages: { key: BoardColumn; label: string; count: number; stuck: number }[];
  /** Pedidos pagos e não entregues com algum cartão ainda sem placa. */
  ordersWithoutPlate: number;
  /** Faltam chips para cobrir os pedidos (o contador ficou negativo). */
  blankChipShortfall: number;
  /** `null` quando o estoque de placas ainda não está disponível (tabelas não migradas). */
  plates: Awaited<ReturnType<typeof getStockSummary>> | null;
}

/**
 * Fase 19.8 — extraído de `admin/page.tsx` (Fase 19.2) para o Modo
 * Executivo (`admin/executivo/page.tsx`) reaproveitar exatamente o mesmo
 * cálculo em vez de reimplementar as mesmas queries/regras de negócio numa
 * segunda tela — o próprio pedido do usuário ("Nenhuma duplicação").
 */
export async function getAdminOverviewSnapshot(): Promise<AdminOverviewSnapshot> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - UNRESOLVED_FEEDBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const supportStuckSince = new Date(Date.now() - SUPPORT_REQUEST_STUCK_HOURS * 60 * 60 * 1000);

  const [allOrders, settings, activeCompanies, unresolvedFeedbackGroups, checkoutStarted, checkoutCompleted, stuckSupportRequests] =
    await Promise.all([
      prisma.storeOrder.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
      getSiteSettings(),
      prisma.company.count({ where: { accountType: "CUSTOMER" } }),
      // Substitui, na auditoria de 28/09/2026, uma consulta a `RatingEvent`
      // com 1-2 estrelas que zerava para sempre desde a ADR-080 — ver o
      // comentário de `unresolvedFeedbackCompanies` em domain/admin/attention-radar.ts.
      prisma.privateFeedback.groupBy({
        by: ["companyId"],
        where: { resolved: false, createdAt: { gte: sevenDaysAgo } },
        _count: { _all: true },
        having: { companyId: { _count: { gte: 3 } } },
      }),
      prisma.storeOrder.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.storeOrder.count({ where: { createdAt: { gte: thirtyDaysAgo }, status: { not: "PENDING_PAYMENT" } } }),
      listStuckSupportRequests(supportStuckSince),
    ]);

  const unresolvedFeedbackCompanies = await Promise.all(
    unresolvedFeedbackGroups.map(async (g) => {
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

  const cardUrlGuard = getCardUrlGuard();

  // Produção por etapa: a mesma regra do quadro e da lista (deriveBoardColumn), nunca uma segunda.
  const stages = BOARD_COLUMNS.map((column) => ({ key: column.key, label: column.label, count: 0, stuck: 0 }));
  for (const order of allOrders) {
    if (order.status !== "PAID" && order.status !== "SHIPPED" && order.status !== "DELIVERED") continue;
    const entry = stages.find((s) => s.key === deriveBoardColumn(order));
    if (!entry) continue;
    entry.count++;
    if (entry.key !== "ENTREGUE" && daysSince(stageEnteredAt(order)) >= 3) entry.stuck++;
  }

  // Estoque de placas (ADR-092): acréscimos. Qualquer falha (ex.: tabelas ainda
  // não migradas) vira "sem placas" — o Centro de Operações nunca cai por causa
  // de um módulo opcional.
  const plates = await getStockSummary().catch((error) => {
    console.error("[admin-overview] não foi possível ler o resumo de placas", error);
    return null;
  });
  const ordersWithoutPlate = await countOrdersWithoutPlate(activeProduction);

  const plateRadar: RadarPlateInputs = await getRadarPlateInputs().catch((error) => {
    console.error("[admin-overview] não foi possível ler o estoque de placas", error);
    return { plateStock: [], plateBatches: [] };
  });

  const radar = buildAttentionRadar({
    cardUrl: {
      kind: cardUrlGuard.status.kind,
      host: cardUrlGuard.status.host,
      blocked: cardUrlGuard.blocked,
      pendingOrders: activeProduction.length,
    },
    stuckOrders,
    lowStock: { blankChipStock: stock, lowStockThreshold },
    disputedOrders: disputedOrders.map((o) => ({ id: o.id, customerName: o.customerName, disputeStatus: o.disputeStatus })),
    unresolvedFeedbackCompanies,
    stuckSupportRequests: stuckSupportRequests.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: r.company.name,
      subject: r.subject,
    })),
    // Achado de auditoria de potencial de venda (29/09/2026) — ver o
    // comentário completo em domain/admin/attention-radar.ts.
    emailProviderConfigured: resend !== null,
    plateStock: plateRadar.plateStock,
    plateBatches: plateRadar.plateBatches,
  }).map((insight) => {
    if (insight.id.startsWith("feedback:")) return { ...insight, href: `/admin/empresas/${insight.id.split(":")[1]}` };
    if (insight.id.startsWith("support:")) return { ...insight, href: `/admin/empresas/${insight.id.split(":")[1]}` };
    if (insight.id === "low-stock") return { ...insight, href: "/admin/conteudo" };
    // O endereço do cartão é uma variável de ambiente na Vercel: nenhuma tela do painel o resolve.
    if (insight.id === "card-url") return insight;
    if (insight.id.startsWith("plate-stock:")) return { ...insight, href: "/admin/estoque" };
    if (insight.id.startsWith("plate-batch:")) return { ...insight, href: `/admin/estoque/lotes/${insight.id.split(":")[1]}` };
    // Sem tela no Admin que resolva isto (é uma env var na Vercel, não uma
    // configuração do produto) — nenhum href é melhor que um errado.
    if (insight.id === "email-provider") return insight;
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
    stages,
    ordersWithoutPlate,
    blankChipShortfall: Math.max(0, -stock),
    plates,
  };
}

/** Pedidos em produção com ao menos um cartão sem placa. Falha → 0 (módulo opcional). */
async function countOrdersWithoutPlate(orders: { provisionedCardIds: string[] }[]): Promise<number> {
  try {
    const withCards = orders.filter((o) => o.provisionedCardIds.length > 0);
    const cardIds = withCards.flatMap((o) => o.provisionedCardIds);
    if (cardIds.length === 0) return 0;
    const plates = await prisma.plate.findMany({ where: { cardId: { in: cardIds } }, select: { cardId: true } });
    const withPlate = new Set(plates.map((p) => p.cardId));
    return withCards.filter((o) => o.provisionedCardIds.some((id) => !withPlate.has(id))).length;
  } catch (error) {
    console.error("[admin-overview] não foi possível contar pedidos sem placa", error);
    return 0;
  }
}
