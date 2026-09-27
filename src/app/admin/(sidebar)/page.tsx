import { Boxes, Building2, Gavel, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { getAdminOverviewSnapshot } from "@/services/admin-overview.service";
import { formatCentsToBRL } from "@/lib/store-products";
import { KpiCard, AnalyticsCard, InsightCardList } from "@nfc-os/ui";
import { OperationsTimeline } from "@/components/admin/operations-timeline";

/**
 * Fase 19.2 — o Centro de Operações de verdade: KPIs de negócio real (não
 * mais contagens genéricas), Radar de Atenção (o que precisa da sua ação
 * agora, calculado sobre dado real — Zero Fake Demo) e a Timeline Viva
 * (SSE global, `OperationsTimeline`). `admin/pedidos` continua sendo o
 * lugar de AGIR sobre um pedido; esta página é o lugar de SABER o que
 * precisa de ação. Fase 19.8 — o cálculo virou `getAdminOverviewSnapshot()`
 * (`services/admin-overview.service.ts`), reaproveitado também pelo Modo
 * Executivo (`admin/executivo`), nunca duas cópias da mesma lógica.
 */
export default async function AdminOverviewPage() {
  const snapshot = await getAdminOverviewSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Centro de Operações</h1>
        <p className="text-sm text-muted-foreground">O que precisa da sua atenção agora — vendas, produção, empresas e reputação, num só lugar.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Faturamento líquido (30 dias)" value={formatCentsToBRL(snapshot.revenue30dCents)} icon={<Wallet />} hint="Pago menos reembolsos" />
        <KpiCard
          label="Pedidos em risco"
          value={snapshot.disputedOrdersCount}
          icon={<Gavel />}
          valueClassName={snapshot.disputedOrdersCount > 0 ? "text-red-600 dark:text-red-400" : undefined}
          hint="Disputa aberta no Stripe"
        />
        <KpiCard label="Produção ativa" value={snapshot.activeProductionCount} icon={<ShoppingCart />} hint="Pago ou enviado, ainda não entregue" />
        <KpiCard
          label="Chips NFC em branco"
          value={snapshot.stock}
          icon={<Boxes />}
          valueClassName={snapshot.stock < snapshot.lowStockThreshold ? "text-amber-600 dark:text-amber-400" : undefined}
          hint={snapshot.stock < snapshot.lowStockThreshold ? "Abaixo do mínimo — repor" : "Estoque saudável"}
        />
        <KpiCard label="Empresas no SaaS" value={snapshot.activeCompanies} icon={<Building2 />} hint="Total de contas ativas" />
        <KpiCard
          label="Conversão da loja (30 dias)"
          value={snapshot.conversionRate !== null ? `${snapshot.conversionRate}%` : "—"}
          icon={<TrendingUp />}
          hint={`${snapshot.checkoutCompleted} de ${snapshot.checkoutStarted} checkouts pagos`}
        />
      </div>

      <AnalyticsCard title="Radar de Atenção" description="Gerado automaticamente a partir de dado real — nunca um exemplo.">
        <InsightCardList insights={snapshot.radar} emptyLabel="Tudo em ordem — nenhum alerta no momento." />
      </AnalyticsCard>

      <AnalyticsCard title="Atividade ao vivo">
        <OperationsTimeline />
      </AnalyticsCard>
    </div>
  );
}
