"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, Sparkles, Zap } from "lucide-react";
import { PremiumCardShell } from "@nfc-os/ui";
import { PLANS } from "@/lib/plans";
import { formatCentsToBRL } from "@/lib/store-products";
import { cn } from "@/lib/utils";
import type { PlanType } from "@/generated/prisma/client";

interface Option {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** O que a pessoa vai pagar nesse caminho — transparência ANTES do Stripe. */
  price: string;
  href: string;
  recommended?: boolean;
}

/**
 * As 3 respostas da tela de descoberta (C15) e pra onde cada uma leva.
 * `hasCard=1` é o parâmetro que faltava: hoje ninguém pergunta "você já tem
 * um cartão Pulse?" antes de mandar todo mundo pro mesmo formulário — ele
 * viaja `/sign-up` → `/onboarding` → `/onboarding/plan`, mesmo padrão que
 * `plan`/`cardProductId` já usam, e faz `PlanSelector` colapsar o add-on de
 * cartão físico pra quem já respondeu que não precisa.
 *
 * O valor de cada caminho aparece já aqui (o pedido: "tudo precisa aumentar
 * confiança antes do Stripe") — calculado de `PLANS` + do preço do cartão
 * que a página recebe (mesma fonte da Loja), nunca um texto fixo que pode
 * divergir do que o checkout cobra.
 */
export function DiscoveryOptions({ plan, cardPriceCents }: { plan: PlanType; cardPriceCents: number | null }) {
  const planDef = PLANS[plan];
  const planMonthlyCents = planDef.priceMonthly * 100;
  const cardLabel = cardPriceCents !== null ? formatCentsToBRL(cardPriceCents) : null;
  const todayBothLabel = cardPriceCents !== null ? formatCentsToBRL(planMonthlyCents + cardPriceCents) : null;

  const options: Option[] = [
    {
      icon: <CreditCard className="size-6" />,
      title: "Comprar meu primeiro cartão",
      description: "Só o cartão físico, sem assinar nada agora. Escolha o destino e pronto.",
      price: cardLabel ? `${cardLabel} uma vez · sem mensalidade` : "Sem mensalidade",
      href: "/loja?produto=single",
    },
    {
      icon: <Zap className="size-6" />,
      title: "Já tenho um cartão Pulse",
      description: "Quero assinar o Starter pra ativar o Retorno e as campanhas — sem comprar cartão de novo.",
      price: `${planDef.priceLabel} · nenhum cartão cobrado`,
      href: `/sign-up?plan=${plan}&hasCard=1`,
    },
    {
      icon: <Sparkles className="size-6" />,
      title: "Quero assinar o Starter",
      description: "Ainda não tenho cartão nenhum. Monto a assinatura e o cartão juntos, numa cobrança só.",
      price: todayBothLabel ? `${todayBothLabel} hoje · depois ${planDef.priceLabel}` : planDef.priceLabel,
      href: `/sign-up?plan=${plan}&cardProductId=single`,
      recommended: true,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {options.map((option) => (
        <Link key={option.title} href={option.href} className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <PremiumCardShell
            interactive
            className={cn("flex h-full flex-col gap-3 p-6", option.recommended && "border-brand/60 shadow-premium")}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-subtle text-brand-ink">{option.icon}</span>
              {option.recommended ? (
                <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-medium text-brand-foreground">Mais escolhido</span>
              ) : null}
            </div>
            <h2 className="text-base font-semibold leading-tight">{option.title}</h2>
            <p className="flex-1 text-sm text-muted-foreground">{option.description}</p>
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
              <span className="text-xs font-medium tabular-nums text-foreground">{option.price}</span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink" />
            </div>
          </PremiumCardShell>
        </Link>
      ))}
    </div>
  );
}
