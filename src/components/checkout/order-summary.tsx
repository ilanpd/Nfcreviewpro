import { PremiumCardShell } from "@nfc-os/ui";

export interface OrderSummaryItem {
  label: string;
  priceLabel: string;
}

/**
 * Resumo do pedido (C15) — dá confiança ANTES do Stripe, na voz do produto,
 * enquanto a pessoa ainda decide (o próprio Stripe Checkout já mostra um
 * resumo nativo do que vai ser cobrado, mas só depois do redirect, com a
 * escolha já fechada). Componente puro: não sabe nada de Stripe/checkout,
 * só de exibição — por isso serve tanto `PlanSelector` (assinatura + cartão)
 * quanto `PurchaseDialog` da Loja (só cobrança única).
 *
 * `shippingLabel` nasce aqui, oculto por padrão: hoje nenhum fluxo cobra
 * frete separado (o preço do cartão já inclui tudo), mas o slot já existe
 * pra não exigir retrabalho se essa decisão mudar.
 */
export function OrderSummary({
  items,
  totalDueTodayLabel,
  totalRecurringLabel,
  shippingLabel,
}: {
  items: OrderSummaryItem[];
  totalDueTodayLabel: string;
  totalRecurringLabel?: string;
  shippingLabel?: string;
}) {
  return (
    <PremiumCardShell className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumo do pedido</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium tabular-nums">{item.priceLabel}</span>
          </li>
        ))}
        {shippingLabel ? (
          <li className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Frete</span>
            <span className="font-medium tabular-nums">{shippingLabel}</span>
          </li>
        ) : null}
      </ul>
      <div className="mt-4 space-y-1 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold">Total hoje</span>
          <span className="text-lg font-semibold tabular-nums">{totalDueTodayLabel}</span>
        </div>
        {totalRecurringLabel ? <p className="text-xs text-muted-foreground">Depois, {totalRecurringLabel}</p> : null}
      </div>
    </PremiumCardShell>
  );
}
