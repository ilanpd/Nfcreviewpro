import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ArrowLeft, Boxes, Building2, Gavel, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { getAdminOverviewSnapshot } from "@/services/admin-overview.service";
import { getFinanceSnapshot } from "@/services/finance.service";
import { PLANS } from "@/lib/plans";
import { AnalyticsCard, InsightCardList, RankingList } from "@nfc-os/ui";
import { OperationsTimeline } from "@/components/admin/operations-timeline";
import { WallboardMetric } from "@/components/admin/wallboard-metric";
import { WallboardClock } from "@/components/admin/wallboard-clock";

/**
 * Modo Executivo (Fase 19.8) — wallboard full-bleed, sem sidebar (route
 * group `(sidebar)` do resto do Admin não envolve esta rota — ver
 * `admin/layout.tsx`). Composição pura do que as sub-fases 19.2/19.6 já
 * construíram (`getAdminOverviewSnapshot`/`getFinanceSnapshot`, o mesmo
 * Radar de Atenção e a mesma Timeline Viva) — nenhuma query nova, nenhuma
 * regra de negócio nova. `className="dark"` força a paleta escura do
 * design system (`@custom-variant dark`) independente do tema do
 * visitante — um wallboard de sala de operação não deveria mudar de cor
 * conforme o SO de quem entrou no link; `bg-noc-surface` é o token dedicado
 * a telas tipo Mission Control (existe desde a Fase A, usado antes só em
 * `/dev/ceo/mission-control`).
 */
export default async function AdminExecutivePage() {
  const [ops, finance] = await Promise.all([getAdminOverviewSnapshot(), getFinanceSnapshot()]);

  const planDistribution = finance.revenue.planDistribution.map((entry) => ({
    id: entry.plan,
    label: PLANS[entry.plan].name,
    value: entry.companyCount,
    secondaryLabel: entry.companyCount === 1 ? "empresa" : "empresas",
  }));

  return (
    <div className="dark min-h-screen bg-noc-surface text-foreground">
      <header className="flex items-center justify-between border-b border-noc-border px-8 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Sair do Modo Executivo
          </Link>
          <h1 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{BRAND.name} · Modo Executivo</h1>
        </div>
        <WallboardClock />
      </header>

      <div className="space-y-8 p-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-3 xl:grid-cols-6">
          <WallboardMetric label="Faturamento loja (30d)" value={Math.round(ops.revenue30dCents / 100)} prefix="R$ " icon={<Wallet className="size-4" />} />
          <WallboardMetric label="MRR" value={Math.round(finance.revenue.mrrCents / 100)} prefix="R$ " icon={<Wallet className="size-4" />} />
          <WallboardMetric label="Empresas no SaaS" value={ops.activeCompanies} icon={<Building2 className="size-4" />} />
          <WallboardMetric
            label="Pedidos em risco"
            value={ops.disputedOrdersCount}
            tone={ops.disputedOrdersCount > 0 ? "danger" : "default"}
            icon={<Gavel className="size-4" />}
          />
          <WallboardMetric label="Produção ativa" value={ops.activeProductionCount} icon={<ShoppingCart className="size-4" />} />
          <WallboardMetric
            label="Chips em branco"
            value={ops.stock}
            tone={ops.stock < ops.lowStockThreshold ? "warning" : "default"}
            icon={<Boxes className="size-4" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AnalyticsCard title="Radar de Atenção" description="Gerado automaticamente a partir de dado real — nunca um exemplo.">
            <InsightCardList insights={ops.radar} emptyLabel="Tudo em ordem — nenhum alerta no momento." />
          </AnalyticsCard>
          <AnalyticsCard title="Atividade ao vivo">
            <OperationsTimeline />
          </AnalyticsCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <WallboardMetric label="ARR projetado" value={Math.round(finance.revenue.arrCents / 100)} prefix="R$ " icon={<TrendingUp className="size-4" />} />
          <AnalyticsCard title="Distribuição de planos" description="Entre empresas clientes com assinatura ativa hoje.">
            <RankingList entries={planDistribution} emptyLabel="Nenhuma assinatura ativa no momento." />
          </AnalyticsCard>
        </div>
      </div>
    </div>
  );
}
