import { Wallet, TrendingUp, ShoppingBag, PiggyBank } from "lucide-react";
import { getFinanceSnapshot } from "@/services/finance.service";
import { formatCentsToBRL } from "@/lib/store-products";
import { PLANS } from "@/lib/plans";
import { KpiCard, AnalyticsCard, RankingList } from "@nfc-os/ui";

/**
 * Fase 19.6 — Financeiro, snapshot honesto: MRR/ARR de HOJE (soma do preço
 * do plano de toda empresa CUSTOMER — nunca GUEST, ver ADR-065 — com
 * assinatura Stripe realmente "active") e receita física da loja (30/90
 * dias, mesmo cálculo de `admin/pedidos`/`admin`, generalizado). Sem
 * gráfico de tendência/cohort/churn nesta fase: `Company` nunca guardou
 * quando cada troca de plano aconteceu antes de hoje — fabricar uma curva
 * histórica violaria Zero Fake Demo. O evento `PlanoAlterado` (event bus)
 * começa a registrar toda troca a partir de agora, para existir dado real
 * de tendência dentro de alguns meses. Fase 19.8 — o cálculo virou
 * `getFinanceSnapshot()` (`services/finance.service.ts`), reaproveitado
 * também pelo Modo Executivo (`admin/executivo`).
 */
export default async function AdminFinanceiroPage() {
  const { revenue, physicalRevenue30dCents, physicalRevenue90dCents } = await getFinanceSnapshot();
  const planDistribution = revenue.planDistribution.map((entry) => ({
    id: entry.plan,
    label: PLANS[entry.plan].name,
    value: entry.companyCount,
    secondaryLabel: entry.companyCount === 1 ? "empresa" : "empresas",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Snapshot de hoje — assinaturas ativas e receita física da loja. Sem gráfico de tendência ainda: toda troca de
          plano passa a ser registrada a partir de agora, para existir histórico real dentro de alguns meses.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="MRR"
          value={formatCentsToBRL(revenue.mrrCents)}
          icon={<Wallet />}
          hint={`${revenue.payingCompanyCount} de ${revenue.totalCustomerCount} empresas clientes com assinatura ativa`}
        />
        <KpiCard
          label="ARR projetado"
          value={formatCentsToBRL(revenue.arrCents)}
          icon={<TrendingUp />}
          hint="MRR × 12 — projeção, não histórico"
        />
        <KpiCard
          label="Receita física (30 dias)"
          value={formatCentsToBRL(physicalRevenue30dCents)}
          icon={<ShoppingBag />}
          hint="Loja de cartões, pago menos reembolsos"
        />
        <KpiCard
          label="Receita física (90 dias)"
          value={formatCentsToBRL(physicalRevenue90dCents)}
          icon={<PiggyBank />}
          hint="Loja de cartões, pago menos reembolsos"
        />
      </div>

      <AnalyticsCard title="Distribuição de planos" description="Entre empresas clientes com assinatura ativa hoje.">
        <RankingList entries={planDistribution} emptyLabel="Nenhuma assinatura ativa no momento." />
      </AnalyticsCard>
    </div>
  );
}
