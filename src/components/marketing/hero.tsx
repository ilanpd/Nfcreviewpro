"use client";

import Link from "next/link";
import { ArrowRight, PlayCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { AuroraBackground, CursorGlow, GlassPremiumCard, MagneticButton } from "@nfc-os/ui";
import { DiaTextReveal } from "@/components/ui/dia-text-reveal";

/** Paleta da varredura do headline — sempre os tokens de marca do produto,
 * nunca a paleta padrão do componente (rosa/laranja/azul genéricos do
 * template original do Magic UI). Ver ADR-059. */
const HEADLINE_SWEEP_COLORS = ["var(--brand)", "var(--chart-2)", "var(--brand)"];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28">
      <AuroraBackground variant="vivid" />

      <CursorGlow className="mx-auto flex max-w-4xl flex-col items-center text-center" size={560}>
        <BlurFade delay={0}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            Cartões NFC inteligentes para gestão de reputação
          </div>
        </BlurFade>

        <BlurFade delay={0.05}>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            <DiaTextReveal
              text="Transforme cada cliente satisfeito em uma nova avaliação."
              colors={HEADLINE_SWEEP_COLORS}
              duration={1.8}
              delay={0.3}
            />
          </h1>
        </BlurFade>

        <BlurFade delay={0.1}>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
            Um toque no cartão NFC leva o cliente direto para avaliar seu negócio no Google — e captura os problemas
            antes que virem uma avaliação ruim.
          </p>
        </BlurFade>

        <BlurFade delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up">
              <div className="relative rounded-lg">
                <MagneticButton size="lg" className="gap-2">
                  Começar grátis
                  <ArrowRight className="size-4" />
                </MagneticButton>
                <BorderBeam colorFrom="var(--brand)" colorTo="var(--chart-2)" size={60} duration={5} />
              </div>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" variant="outline" className="gap-2">
                <PlayCircle className="size-4" />
                Ver como funciona
              </Button>
            </a>
          </div>
        </BlurFade>

        <BlurFade delay={0.25} offset={16}>
          <div className="relative mt-16 w-full max-w-3xl">
            <GlassPremiumCard className="aspect-video overflow-hidden shadow-premium" glass>
              <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-muted/40 to-muted/10">
                <div className="flex items-center justify-center rounded-full bg-background/80 p-5 shadow-sm">
                  <PlayCircle className="size-10 text-brand" />
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Vídeo demonstrativo em breve</p>
              </div>
            </GlassPremiumCard>
          </div>
        </BlurFade>
      </CursorGlow>
    </section>
  );
}
