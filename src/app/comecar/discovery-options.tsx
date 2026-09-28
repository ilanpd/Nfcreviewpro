"use client";

import Link from "next/link";
import { CreditCard, Sparkles, Zap } from "lucide-react";
import { PremiumCardShell } from "@nfc-os/ui";
import type { PlanType } from "@/generated/prisma/client";

interface Option {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

/**
 * As 3 respostas da tela de descoberta (C15) e pra onde cada uma leva.
 * `hasCard=1` é o parâmetro que faltava: hoje ninguém pergunta "você já tem
 * um cartão Pulse?" antes de mandar todo mundo pro mesmo formulário — ele
 * viaja `/sign-up` → `/onboarding` → `/onboarding/plan`, mesmo padrão que
 * `plan`/`cardProductId` já usam, e faz `PlanSelector` colapsar o add-on de
 * cartão físico pra quem já respondeu que não precisa.
 */
export function DiscoveryOptions({ plan }: { plan: PlanType }) {
  const options: Option[] = [
    {
      icon: <CreditCard className="size-6" />,
      title: "Comprar meu primeiro cartão",
      description: "Só o cartão físico, sem assinar nada agora. Escolha o destino e pronto.",
      href: "/loja?produto=single",
    },
    {
      icon: <Zap className="size-6" />,
      title: "Já tenho um cartão Pulse",
      description: "Quero assinar o Starter pra ativar o Retorno e as campanhas — sem comprar cartão de novo.",
      href: `/sign-up?plan=${plan}&hasCard=1`,
    },
    {
      icon: <Sparkles className="size-6" />,
      title: "Quero assinar o Starter",
      description: "Ainda não tenho cartão nenhum. Monto a assinatura e o cartão juntos, numa cobrança só.",
      href: `/sign-up?plan=${plan}&cardProductId=single`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {options.map((option) => (
        <Link key={option.title} href={option.href} className="block h-full">
          <PremiumCardShell interactive className="flex h-full flex-col gap-3 p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-subtle text-brand-ink">{option.icon}</span>
            <h2 className="text-base font-semibold leading-tight">{option.title}</h2>
            <p className="text-sm text-muted-foreground">{option.description}</p>
          </PremiumCardShell>
        </Link>
      ))}
    </div>
  );
}
