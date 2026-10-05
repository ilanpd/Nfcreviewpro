import Link from "next/link";
import { ArrowRight, Boxes, CircleCheck, Factory, TrendingUp, Wallet } from "lucide-react";
import { KpiCard, AnalyticsCard } from "@nfc-os/ui";
import { getAdminOverviewSnapshot } from "@/services/admin-overview.service";
import { formatCentsToBRL } from "@/lib/store-products";
import { OperationsTimeline } from "@/components/admin/operations-timeline";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Centro de Operações: o que precisa da sua ação agora, em ordem de uso. Quatro
 * números que importam; a produção etapa por etapa (cada etapa leva direto aos
 * pedidos dela); o que o radar encontrou, com o caminho para resolver; o estoque
 * de placas; e a atividade ao vivo. `admin/pedidos` continua sendo o lugar de
 * AGIR sobre um pedido; esta página é o lugar de SABER onde agir. O cálculo mora
 * em `getAdminOverviewSnapshot()` (reaproveitado pelo Modo Executivo).
 */
export default async function AdminOverviewPage() {
  const snapshot = await getAdminOverviewSnapshot();
  const { plates } = snapshot;
  const lowCount = plates?.lowModels.length ?? 0;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Centro de Operações</h1>
        <p className="text-sm text-muted-foreground">O que precisa da sua atenção agora: vendas, produção, estoque e clientes, num só lugar.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Faturamento (30 dias)" value={formatCentsToBRL(snapshot.revenue30dCents)} icon={<Wallet />} hint="Pago menos reembolsos" valueClassName="text-2xl" />
        <KpiCard
          label="Produção ativa"
          value={snapshot.activeProductionCount}
          icon={<Factory />}
          hint={snapshot.ordersWithoutPlate > 0 ? `${snapshot.ordersWithoutPlate} pedido(s) com cartão sem placa` : "Pago ou enviado, não entregue"}
        />
        <KpiCard
          label="Placas em estoque"
          value={plates ? plates.inStock : "—"}
          icon={<Boxes />}
          hint={!plates ? "Estoque de placas indisponível" : lowCount > 0 ? `${lowCount} modelo(s) abaixo do mínimo` : plates.modelCount === 0 ? "Crie o primeiro modelo" : "Conferidas e sem dono"}
          valueClassName={lowCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        />
        <KpiCard
          label="Conversão da loja (30 dias)"
          value={snapshot.conversionRate !== null ? `${snapshot.conversionRate}%` : "—"}
          icon={<TrendingUp />}
          hint={`${snapshot.checkoutCompleted} de ${snapshot.checkoutStarted} checkouts pagos`}
        />
      </div>

      <section aria-labelledby="producao-titulo" className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="producao-titulo" className="text-lg font-semibold">
            Produção por etapa
          </h2>
          <p className="text-xs text-muted-foreground">Clique numa etapa para ver os pedidos dela.</p>
        </div>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {snapshot.stages.map((stage) => (
            <li key={stage.key} className="min-w-0">
              <Link
                href={`/admin/pedidos?etapa=${stage.key}`}
                className={cn("block rounded-xl border p-3 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none", stage.stuck > 0 && "border-amber-500/40")}
              >
                <p className="truncate text-xs text-muted-foreground" title={stage.label}>
                  {stage.label}
                </p>
                <p className={cn("text-2xl font-semibold tabular-nums", stage.count === 0 && "text-muted-foreground/60")}>{stage.count}</p>
                <p className={cn("truncate text-[11px]", stage.stuck > 0 ? "font-medium text-amber-600 dark:text-amber-400" : "text-transparent select-none")} aria-hidden={stage.stuck === 0}>
                  {stage.stuck > 0 ? `${stage.stuck} parado${stage.stuck === 1 ? "" : "s"}` : "—"}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-labelledby="atencao-titulo" className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 id="atencao-titulo" className="text-lg font-semibold">
              Precisa de ação
            </h2>
            <p className="text-xs text-muted-foreground">Calculado de dados reais, nunca um exemplo.</p>
          </div>
          {snapshot.radar.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-800 dark:text-emerald-200">
              <CircleCheck className="size-4 shrink-0" aria-hidden="true" /> Tudo em ordem: nenhum alerta no momento.
            </p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {snapshot.radar.map((insight) => {
                const content = (
                  <>
                    <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", insight.severity === "attention" ? "bg-amber-500" : "bg-muted-foreground/40")} />
                    <span className="min-w-0 flex-1 text-sm leading-snug break-words">{insight.message}</span>
                    {insight.href ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-ink">
                        Resolver <ArrowRight className="size-3.5" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">configuração</span>
                    )}
                  </>
                );
                return (
                  <li key={insight.id}>
                    {insight.href ? (
                      <Link href={insight.href} className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/50">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 p-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-label="Estoque e números de apoio" className="min-w-0 space-y-4">
          <section aria-labelledby="estoque-titulo" className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="estoque-titulo" className="flex items-center gap-1.5 text-sm font-semibold">
                <Boxes className="size-4" aria-hidden="true" /> Estoque de placas
              </h2>
              <Link href="/admin/estoque" className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline">
                Abrir <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
            {plates ? (
              <>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <dt className="text-[11px] text-muted-foreground">Em estoque</dt>
                    <dd className="text-xl font-semibold tabular-nums">{plates.inStock}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <dt className="text-[11px] text-muted-foreground">Em produção</dt>
                    <dd className="text-xl font-semibold tabular-nums">{plates.inProduction}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <dt className="text-[11px] text-muted-foreground">Com clientes</dt>
                    <dd className="text-xl font-semibold tabular-nums">{plates.assigned}</dd>
                  </div>
                </dl>
                {plates.lowModels.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {plates.lowModels.map((model) => (
                      <li key={model.modelId} className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-xs">
                        <span className="min-w-0 truncate font-medium">{model.modelName}</span>
                        <span className="shrink-0 text-amber-700 dark:text-amber-300">
                          {model.inStock} de {model.minStock}
                          {model.incoming > 0 ? ` · ${model.incoming} a caminho` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">{plates.modelCount === 0 ? "Nenhum modelo ainda. Crie o primeiro em Estoque de placas." : "Nenhum modelo abaixo do estoque mínimo."}</p>
                )}
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">O estoque de placas ainda não está disponível neste ambiente.</p>
            )}
          </section>

          <section aria-labelledby="apoio-titulo" className="rounded-xl border p-4">
            <h2 id="apoio-titulo" className="text-sm font-semibold">
              Outros números
            </h2>
            <dl className="mt-3 divide-y text-sm">
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Empresas no SaaS</dt>
                <dd className="font-medium tabular-nums">{snapshot.activeCompanies}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Pedidos em risco (disputa)</dt>
                <dd className={cn("font-medium tabular-nums", snapshot.disputedOrdersCount > 0 && "text-red-600 dark:text-red-400")}>{snapshot.disputedOrdersCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Chips NFC em branco</dt>
                <dd className="text-right">
                  <span className={cn("font-medium tabular-nums", snapshot.blankChipShortfall > 0 || snapshot.stock < snapshot.lowStockThreshold ? "text-amber-600 dark:text-amber-400" : undefined)}>{Math.max(0, snapshot.stock)}</span>
                  {snapshot.blankChipShortfall > 0 ? <span className="block text-[11px] text-amber-700 dark:text-amber-300">faltam {snapshot.blankChipShortfall} para cobrir os pedidos</span> : null}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <AnalyticsCard title="Atividade ao vivo">
        <OperationsTimeline />
      </AnalyticsCard>
    </div>
  );
}
