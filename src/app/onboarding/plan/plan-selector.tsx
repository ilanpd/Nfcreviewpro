"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DestinationPicker } from "@/components/destination-picker";
import { BorderBeam } from "@/components/ui/border-beam";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/plans";
import { STORE_PRODUCTS, formatCentsToBRL } from "@/lib/store-products";
import type { PlanType } from "@/generated/prisma/client";

interface PlanSelectorProps {
  initialPlan?: PlanType;
  initialCardProductId?: string;
  hasExistingCards: boolean;
  cardCount: number;
}

/**
 * Fase 21 — o add-on de cartão físico deixa de ser um bloco "(opcional)"
 * discreto (fácil de pular) e vira uma recomendação de verdade: quem chega
 * sem nenhum cartão já vê o pacote "Mais popular" pré-selecionado (ainda
 * trocável); quem já é um convidado promovido via `claimGuestCompany`
 * (sempre tem ≥1 cartão) começa em "Nenhum", porque já tem o que precisa.
 * `initialPlan`/`initialCardProductId` vêm da home ou da Loja (via
 * `/sign-up` → `/onboarding` → aqui) — só pré-selecionam, nunca
 * auto-submetem (é uma ação paga, sempre exige um clique explícito).
 */
export function PlanSelector({ initialPlan, initialCardProductId, hasExistingCards, cardCount }: PlanSelectorProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);
  const [cardProductId, setCardProductId] = useState<string | null>(
    initialCardProductId ?? (hasExistingCards ? null : "pack-20")
  );
  const [destinationUrl, setDestinationUrl] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

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
          <CreditCard className="size-4 text-brand" />
          <h3 className="text-sm font-semibold">Cartões físicos para usar seu plano</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasExistingCards
            ? `Você já tem ${cardCount} ${cardCount === 1 ? "cartão" : "cartões"} — quer adicionar mais?`
            : "Sua assinatura ativa o software; o cartão físico é o que o cliente toca na mesa. Adicione na mesma compra — uma cobrança só."}
        </p>
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
          {STORE_PRODUCTS.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setCardProductId(product.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                cardProductId === product.id ? "border-brand bg-brand text-brand-foreground" : "hover:bg-muted"
              )}
            >
              {product.quantity}x — {formatCentsToBRL(product.unitPriceCents * product.quantity)}
            </button>
          ))}
        </div>

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
            <Link href="/loja" className="font-medium text-brand hover:underline">
              Loja
            </Link>
            .
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
      {Object.values(PLANS).map((plan) => (
        <div
          key={plan.id}
          className={cn(
            "relative flex h-full flex-col rounded-2xl border bg-card p-8 shadow-subtle",
            plan.id === initialPlan || plan.highlighted ? "border-brand shadow-premium" : "border-border/60"
          )}
        >
          {plan.id === initialPlan || plan.highlighted ? (
            <>
              <BorderBeam colorFrom="var(--brand)" colorTo="var(--chart-2)" size={70} duration={5} />
              <span className="mb-4 w-fit rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground">
                {plan.id === initialPlan ? "Recomendado para você" : "Mais popular"}
              </span>
            </>
          ) : null}
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{plan.priceLabel}</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
          <Button
            className="mt-8 w-full"
            variant={plan.id === initialPlan || plan.highlighted ? "default" : "outline"}
            disabled={loadingPlan !== null}
            onClick={() => handleSelect(plan.id)}
          >
            {loadingPlan === plan.id ? "Redirecionando…" : `Assinar ${plan.name}`}
          </Button>
        </div>
      ))}
      </div>
    </div>
  );
}
