"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/plans";
import { STORE_PRODUCTS, formatCentsToBRL } from "@/lib/store-products";

// Fase 21 — todo plano precisa de pelo menos 1 cartão físico pra ser usado;
// isso nunca era dito na home (achado da auditoria do funil, 13/09/2026).
// Derivado de STORE_PRODUCTS, nunca hardcoded — nunca dessincroniza se o
// preço do cartão mudar.
const MIN_CARD_UNIT_PRICE_CENTS = Math.min(...STORE_PRODUCTS.map((p) => p.unitPriceCents));

export function Pricing() {
  return (
    <section id="planos" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <BlurFade inView>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Planos para todo tamanho de negócio</h2>
            <p className="mt-4 text-muted-foreground">Sem contrato de fidelidade. Cancele quando quiser.</p>
          </div>
        </BlurFade>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {Object.values(PLANS).map((plan, i) => (
            <BlurFade key={plan.id} delay={0.08 * i} inView>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border bg-card p-8 shadow-subtle",
                  plan.highlighted ? "border-brand shadow-premium" : "border-border/60"
                )}
              >
                {plan.highlighted ? (
                  <>
                    <span className="mb-4 w-fit rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground">
                      Mais popular
                    </span>
                  </>
                ) : null}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{plan.priceLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  + cartão NFC físico (a partir de {formatCentsToBRL(MIN_CARD_UNIT_PRICE_CENTS)}/un.) — escolha no checkout
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-ink" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/sign-up?plan=${plan.id}`} className="mt-8">
                  <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                    Assinar {plan.name}
                  </Button>
                </Link>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}
