"use client";

import { ArrowRight, ShieldCheck, Truck, Zap } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { BlurFade } from "@/components/ui/blur-fade";

const TRUST_ITEMS = [
  { icon: Zap, label: "Configurado antes de sair da fábrica" },
  { icon: ShieldCheck, label: "QR Code dinâmico + chip NFC no mesmo cartão" },
  { icon: Truck, label: "Envio para todo o Brasil" },
];

/**
 * Copy do funil (C13, ADR-088) — a versão antiga vendia só "cartão premium",
 * sem responder a pergunta real de quem chega aqui ("o que ele faz de
 * verdade?") nem reduzir a objeção óbvia ("preciso assinar algo?"). Reescrito
 * pra responder as duas coisas na primeira dobra, e mencionar o Retorno como
 * upgrade disponível — nunca prometido pro avulso, honesto sobre o que só o
 * Starter entrega.
 */
export function StoreHero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-16 sm:pt-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <BlurFade delay={0}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            Loja oficial {BRAND.name}
          </div>
        </BlurFade>

        <BlurFade delay={0.05}>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Um cartão, qualquer destino — pronto em minutos
          </h1>
        </BlurFade>

        <BlurFade delay={0.1}>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
            Escolha para onde ele leva — Google, Instagram, WhatsApp — direto no checkout. Sem assinar nada agora: é
            só o cartão físico, configurado e pronto pra usar. Quando fizer sentido, ative o Retorno (o brinde que
            traz o cliente de volta) assinando o Starter, sem comprar cartão de novo.
          </p>
        </BlurFade>

        <BlurFade delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a href="#produtos" className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-medium text-brand-foreground shadow-elevated transition-colors hover:bg-brand/90">
              Ver planos e preços
              <ArrowRight className="size-4" />
            </a>
          </div>
        </BlurFade>

        <BlurFade delay={0.2}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-brand-ink" />
                {label}
              </div>
            ))}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
