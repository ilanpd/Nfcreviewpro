import { Boxes, Gavel, Wallet, Clock3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { formatCentsToBRL } from "@/lib/store-products";
import { KpiCard } from "@nfc-os/ui";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { PedidosTabs } from "./pedidos-tabs";

/**
 * Transformação do Painel Admin (13/09/2026) — uma única query traz TODO
 * pedido (qualquer status), com um teto de segurança bem acima de qualquer
 * operação real hoje. O Kanban e a Tabela abaixo recebem o mesmo array e
 * decidem sozinhos o que mostrar — nunca duas queries divergentes contando
 * a mesma coisa de formas diferentes (bug real encontrado antes: "em
 * andamento" incluía pedido já reembolsado por vir de uma query separada).
 */
export default async function AdminOrdersPage() {
  const [allOrders, settings] = await Promise.all([
    prisma.storeOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    getSiteSettings(),
  ]);

  const stock = settings?.blankChipStock ?? 0;
  const lowStockThreshold = settings?.lowStockThreshold ?? 20;

  const activeOrders = allOrders.filter((o) => o.status === "PAID" || o.status === "SHIPPED");
  const pendingPayment = allOrders.filter((o) => o.status === "PENDING_PAYMENT");
  const disputedOrders = allOrders.filter((o) => o.disputeStatus && o.disputeStatus !== "won");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const revenue30d = allOrders
    .filter((o) => o.status !== "PENDING_PAYMENT" && o.status !== "CANCELED" && o.createdAt >= thirtyDaysAgo)
    .reduce((sum, o) => sum + o.amountTotalCents - (o.refundAmountCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos da loja</h1>
        <p className="text-sm text-muted-foreground">
          Pagamento → provisionamento é automático. Arraste um cartão para a coluna seguinte para marcar cada etapa da
          produção física, ou use a Tabela para uma visão completa e pesquisável de todos os pedidos.
        </p>
      </div>

      {disputedOrders.length > 0 ? (
        <Alert variant="destructive">
          <Gavel />
          <AlertTitle>
            {disputedOrders.length} pagamento(s) contestado(s) no Stripe — dinheiro em risco
          </AlertTitle>
          <AlertDescription>
            {disputedOrders.map((o) => (
              <span key={o.id} className="mr-3 inline-block">
                {o.customerName} ({o.disputeStatus})
              </span>
            ))}
            Abra cada pedido no quadro/tabela abaixo para ver o link direto ao Stripe.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Faturamento líquido (30 dias)"
          value={formatCentsToBRL(revenue30d)}
          icon={<Wallet />}
          hint="Pago menos reembolsos"
        />
        <KpiCard
          label="Em produção agora"
          value={activeOrders.length}
          icon={<Clock3 />}
          hint="Pago ou enviado, ainda não entregue"
        />
        <KpiCard
          label="Aguardando pagamento"
          value={pendingPayment.length}
          icon={<Clock3 />}
          hint="Checkout iniciado, sem confirmação do Stripe"
        />
        <KpiCard
          label="Chips NFC em branco no estoque"
          value={stock}
          icon={<Boxes />}
          hint={stock < lowStockThreshold ? "Estoque baixo — repor com o fornecedor" : "Editável em Conteúdo do site"}
          valueClassName={stock < lowStockThreshold ? "text-amber-600 dark:text-amber-400" : undefined}
        />
      </div>

      <PedidosTabs allOrders={allOrders} />
    </div>
  );
}
