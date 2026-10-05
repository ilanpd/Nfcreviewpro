import { Boxes, Clock3, Gavel, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCentsToBRL } from "@/lib/store-products";
import { KpiCard } from "@nfc-os/ui";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { BOARD_COLUMNS } from "@/domain/store-order/board";
import { PedidosTabs, type OrdersView } from "./pedidos-tabs";
import { DirectSaleDialog } from "./direct-sale-dialog";
import type { StageFilter } from "./orders-list";
import type { PlateCoverage } from "./order-stage-control";
import type { StoreOrder } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const VALID_STAGES = new Set<string>(["ALL", "AGUARDANDO", "CANCELADOS", ...BOARD_COLUMNS.map((c) => c.key)]);

/**
 * Quantos cartões de cada pedido já têm placa. Um acréscimo: sem as tabelas de
 * estoque (migração ainda não aplicada) ou com qualquer falha, a lista segue
 * funcionando, só sem a coluna de placas.
 */
async function loadPlateCoverage(orders: StoreOrder[]): Promise<Record<string, PlateCoverage>> {
  try {
    const active = orders.filter((o) => (o.status === "PAID" || o.status === "SHIPPED" || o.status === "DELIVERED") && o.provisionedCardIds.length > 0);
    const cardIds = active.flatMap((o) => o.provisionedCardIds);
    if (cardIds.length === 0) return {};
    const plates = await prisma.plate.findMany({ where: { cardId: { in: cardIds } }, select: { cardId: true } });
    const withPlate = new Set(plates.map((p) => p.cardId));
    return Object.fromEntries(active.map((o) => [o.id, { total: o.provisionedCardIds.length, withPlate: o.provisionedCardIds.filter((id) => withPlate.has(id)).length }]));
  } catch (error) {
    console.error("[admin/pedidos] não foi possível ler a cobertura de placas", error);
    return {};
  }
}

/**
 * Pedidos da loja. Uma única consulta traz TODO pedido (qualquer status), com um
 * teto de segurança bem acima de qualquer operação real hoje. A Lista e o Quadro
 * recebem o mesmo array e decidem sozinhos o que mostrar — nunca duas consultas
 * divergentes contando a mesma coisa de formas diferentes.
 */
export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ etapa?: string; visao?: string }> }) {
  const { etapa, visao } = await searchParams;
  const allOrders = await prisma.storeOrder.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
  const plateCoverage = await loadPlateCoverage(allOrders);

  const initialStage = (etapa && VALID_STAGES.has(etapa) ? etapa : "ALL") as StageFilter;
  const initialView: OrdersView = visao === "quadro" ? "quadro" : "lista";

  const inProduction = allOrders.filter((o) => o.status === "PAID" || o.status === "SHIPPED");
  const pendingPayment = allOrders.filter((o) => o.status === "PENDING_PAYMENT");
  const disputedOrders = allOrders.filter((o) => o.disputeStatus && o.disputeStatus !== "won");
  const withoutPlate = inProduction.filter((o) => {
    const c = plateCoverage[o.id];
    return c ? c.withPlate < c.total : false;
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const revenue30d = allOrders
    .filter((o) => o.status !== "PENDING_PAYMENT" && o.status !== "CANCELED" && o.createdAt >= thirtyDaysAgo)
    .reduce((sum, o) => sum + o.amountTotalCents - (o.refundAmountCents ?? 0), 0);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos da loja</h1>
          <p className="text-sm text-muted-foreground">
            Cada pedido tem uma etapa e uma placa por cartão. Avance a etapa pelo botão da própria linha e clique no pedido para atribuir as placas do estoque.
          </p>
        </div>
        <DirectSaleDialog />
      </div>

      {disputedOrders.length > 0 ? (
        <Alert variant="destructive">
          <Gavel />
          <AlertTitle>{disputedOrders.length} pagamento(s) contestado(s) no Stripe — dinheiro em risco</AlertTitle>
          <AlertDescription>
            {disputedOrders.map((o) => (
              <span key={o.id} className="mr-3 inline-block">
                {o.customerName} ({o.disputeStatus})
              </span>
            ))}
            Abra cada pedido na lista abaixo para ver o link direto ao Stripe.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Faturamento (30 dias)" value={formatCentsToBRL(revenue30d)} icon={<Wallet />} hint="Pago menos reembolsos" valueClassName="text-2xl" />
        <KpiCard label="Em produção" value={inProduction.length} icon={<Clock3 />} hint="Pago ou enviado, não entregue" />
        <KpiCard
          label="Sem placa"
          value={withoutPlate.length}
          icon={<Boxes />}
          hint={withoutPlate.length > 0 ? "Pedidos com cartão sem placa" : "Todos os pedidos têm placa"}
          valueClassName={withoutPlate.length > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        />
        <KpiCard label="Aguardando pagamento" value={pendingPayment.length} icon={<Clock3 />} hint="Checkout sem confirmação" />
      </div>

      <PedidosTabs allOrders={allOrders} plateCoverage={plateCoverage} initialStage={initialStage} initialView={initialView} />
    </div>
  );
}
