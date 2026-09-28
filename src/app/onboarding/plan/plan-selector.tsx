"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DestinationPicker } from "@/components/destination-picker";
import { OrderSummary, type OrderSummaryItem } from "@/components/checkout/order-summary";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/plans";
import { STORE_PRODUCTS, formatCentsToBRL } from "@/lib/store-products";
import type { PlanType } from "@/generated/prisma/client";

interface PlanSelectorProps {
  initialPlan?: PlanType;
  initialCardProductId?: string;
  hasExistingCards: boolean;
  cardCount: number;
  /** C15 — veio da tela de descoberta respondendo "já tenho um cartão Pulse"
   * (Fluxo 2): colapsa o add-on pra uma linha de confirmação, sem picker. */
  hasCard?: boolean;
}

// C15 — só o pacote de 1 unidade faz sentido aqui: o Starter (única
// assinatura à venda hoje) só permite 1 cartão (`cardLimit`). Oferecer
// pack-20/pack-50 no MESMO checkout de assinatura já causou um bug real
// (achado de auditoria): um assinante Starter comprando 20 cartões que o
// próprio plano não deixa usar. Pacotes maiores continuam à venda na Loja,
// pra quem quer comprar mais depois (Fluxo 4) ou nunca vai assinar (Fluxo 1).
const SINGLE_CARD_PRODUCT = STORE_PRODUCTS.find((p) => p.id === "single");

/**
 * Fase 21/C15 — o add-on de cartão físico é uma recomendação de verdade, não
 * um bloco "(opcional)" fácil de pular: quem chega sem nenhum cartão já vê
 * o cartão avulso pré-selecionado (ainda trocável). `initialPlan`/
 * `initialCardProductId` vêm da home ou da Loja (via `/comecar` → `/sign-up`
 * → `/onboarding` → aqui) — só pré-selecionam, nunca auto-submetem (é uma
 * ação paga, sempre exige um clique explícito).
 */
export function PlanSelector({ initialPlan, initialCardProductId, hasExistingCards, cardCount, hasCard }: PlanSelectorProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);
  // Qualquer intenção de cartão vinda da URL (`?cardProductId=`) vira o pacote
  // de 1 unidade: um link antigo com `pack-20` não pode mais chegar aqui
  // como uma seleção que nenhum botão mostra (e o servidor também recusa).
  const [cardProductId, setCardProductId] = useState<string | null>(
    hasCard
      ? null
      : initialCardProductId || !hasExistingCards
        ? (SINGLE_CARD_PRODUCT?.id ?? null)
        : null
  );
  const [destinationUrl, setDestinationUrl] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const cardProduct = cardProductId ? STORE_PRODUCTS.find((p) => p.id === cardProductId) : undefined;

  async function handleSelect(plan: PlanType) {
    if (cardProductId && (!destinationUrl || !customerDocument || !customerPhone)) {
      toast.error("Preencha o link de destino, CPF/CNPJ e telefone para adicionar os cartões físicos.");
      return;
    }
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          ...(cardProductId ? { cardProductId, destinationUrl, customerDocument, customerPhone } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível iniciar o pagamento");
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand/40 bg-brand-subtle/20 p-6">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-brand-ink" />
          <h3 className="text-sm font-semibold">Cartão físico para usar seu plano</h3>
        </div>

        {hasCard ? (
          // Fluxo 2 — respondeu "já tenho um cartão Pulse" na descoberta:
          // nenhum picker, nenhuma cobrança extra, só a confirmação.
          <p className="mt-1 text-xs text-muted-foreground">Você já tem um cartão Pulse — nenhum cartão será cobrado agora.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasExistingCards
                ? `Você já tem ${cardCount} ${cardCount === 1 ? "cartão" : "cartões"} — quer adicionar mais um?`
                : "Sua assinatura ativa o software; o cartão físico é o que o cliente toca na mesa. Adicione na mesma compra — uma cobrança só."}
            </p>
            {SINGLE_CARD_PRODUCT ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCardProductId(null)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    cardProductId === null ? "border-brand bg-brand text-brand-foreground" : "hover:bg-muted"
                  )}
                >
                  Nenhum
                </button>
                <button
                  type="button"
                  onClick={() => setCardProductId(SINGLE_CARD_PRODUCT.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    cardProductId === SINGLE_CARD_PRODUCT.id ? "border-brand bg-brand text-brand-foreground" : "hover:bg-muted"
                  )}
                >
                  1 cartão — {formatCentsToBRL(SINGLE_CARD_PRODUCT.unitPriceCents)}
                </button>
              </div>
            ) : null}

            {cardProductId ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <DestinationPicker value={destinationUrl} onChange={setDestinationUrl} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-document">CPF ou CNPJ</Label>
                  <Input
                    id="plan-document"
                    inputMode="numeric"
                    placeholder="Só números"
                    value={customerDocument}
                    onChange={(e) => setCustomerDocument(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-phone">Telefone</Label>
                  <Input
                    id="plan-phone"
                    type="tel"
                    placeholder="DDD + número"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Prefere decidir depois? Você pode comprar cartões a qualquer momento na{" "}
                <Link href="/loja" className="font-medium text-brand-ink hover:underline">
                  Loja
                </Link>
                .
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
      {Object.values(PLANS).map((plan) => {
        const items: OrderSummaryItem[] = [{ label: `Plano ${plan.name}`, priceLabel: plan.priceLabel }];
        if (cardProduct) {
          items.push({
            label: `${cardProduct.quantity}x cartão físico`,
            priceLabel: formatCentsToBRL(cardProduct.unitPriceCents * cardProduct.quantity),
          });
        }
        const totalDueTodayCents = plan.priceMonthly * 100 + (cardProduct ? cardProduct.unitPriceCents * cardProduct.quantity : 0);

        return (
        <div
          key={plan.id}
          className={cn(
            "relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-8 shadow-subtle",
            plan.id === initialPlan || plan.highlighted ? "border-brand shadow-premium" : "border-border/60"
          )}
        >
          {plan.id === initialPlan || plan.highlighted ? (
            <>
              <span className="w-fit rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground">
                {plan.id === initialPlan ? "Recomendado para você" : "Recomendado"}
              </span>
            </>
          ) : null}
          <div>
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{plan.priceLabel}</p>
          </div>
          <ul className="flex-1 space-y-3 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-ink" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
          {plan.id === initialPlan || plan.highlighted ? (
            <OrderSummary items={items} totalDueTodayLabel={formatCentsToBRL(totalDueTodayCents)} totalRecurringLabel={plan.priceLabel} />
          ) : null}
          {plan.salesActive === false ? (
            <Button className="w-full" variant="outline" disabled>
              Em breve
            </Button>
          ) : (
            <Button
              className="w-full"
              variant={plan.id === initialPlan || plan.highlighted ? "default" : "outline"}
              disabled={loadingPlan !== null}
              onClick={() => handleSelect(plan.id)}
            >
              {loadingPlan === plan.id ? "Redirecionando…" : `Assinar ${plan.name}`}
            </Button>
          )}
        </div>
        );
      })}
      </div>
    </div>
  );
}
