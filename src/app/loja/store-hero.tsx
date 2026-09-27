"use client";

import { ArrowRight, ShieldCheck, Truck, Zap } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { AuroraBackground, CursorGlow } from "@nfc-os/ui";

const TRUST_ITEMS = [
  { icon: Zap, label: "Configurado antes de sair da fábrica" },
  { icon: ShieldCheck, label: "QR Code dinâmico + chip NFC no mesmo cartão" },
  { icon: Truck, label: "Envio para todo o Brasil" },
];

export function StoreHero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-16 sm:pt-28">
      <AuroraBackground variant="vivid" />

      <CursorGlow className="mx-auto flex max-w-4xl flex-col items-center text-center" size={560}>
        <BlurFade delay={0}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            Loja oficial NFC OS
          </div>
        </BlurFade>

        <BlurFade delay={0.05}>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Cartões NFC premium, prontos para o seu negócio
          </h1>
        </BlurFade>

        <BlurFade delay={0.1}>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
            Escolha para onde o cartão redireciona na hora da compra — Google Reviews, Instagram, WhatsApp, o que você
            quiser. Sem precisar assinar o software: só o cartão físico, configurado e pronto para usar.
          </p>
        </BlurFade>

        <BlurFade delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a href="#produtos" className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-medium text-brand-foreground shadow-premium transition-transform hover:scale-[1.02]">
              Ver planos e preços
              <ArrowRight className="size-4" />
            </a>
          </div>
        </BlurFade>

        <BlurFade delay={0.2}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-brand" />
                {label}
              </div>
            ))}
          </div>
        </BlurFade>
      </CursorGlow>
    </section>
  );
}
