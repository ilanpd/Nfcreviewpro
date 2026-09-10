"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Particles } from "@/components/ui/particles";
import { BorderBeam } from "@/components/ui/border-beam";
import { BlurFade } from "@/components/ui/blur-fade";
import { DiaTextReveal } from "@/components/ui/dia-text-reveal";
import { MagneticButton } from "@nfc-os/ui";

const HEADLINE_SWEEP_COLORS = ["var(--brand-foreground)", "var(--chart-2)", "var(--brand-foreground)"];

/** O bookend cinematográfico do Hero — mesma linguagem (Dia Text Reveal,
 * Magnetic Button, Border Beam), reservado só para abertura e fechamento
 * da Landing (nunca repetido nas seções do meio, por moderação). */
export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <BlurFade inView offset={16}>
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-20 text-center sm:px-16"
          style={{
            background: "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklch, var(--brand) 55%, var(--chart-2)) 100%)",
          }}
        >
          <Particles className="absolute inset-0" quantity={60} color="#ffffff" size={0.5} ease={40} />

          <h2 className="relative text-3xl font-semibold tracking-tight text-brand-foreground sm:text-4xl">
            <DiaTextReveal
              text="Pronto para transformar sua reputação online?"
              colors={HEADLINE_SWEEP_COLORS}
              textColor="var(--brand-foreground)"
              duration={1.6}
            />
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-brand-foreground/80">
            Configure sua empresa em minutos e receba seu primeiro cartão NFC pronto para uso.
          </p>
          <div className="relative mt-8 inline-block">
            <Link href="/sign-up">
              <div className="relative rounded-lg">
                <MagneticButton size="lg" variant="secondary" className="gap-2">
                  Começar grátis
                  <ArrowRight className="size-4" />
                </MagneticButton>
                <BorderBeam colorFrom="var(--brand-foreground)" colorTo="var(--chart-2)" size={60} duration={5} />
              </div>
            </Link>
          </div>
        </div>
      </BlurFade>
    </section>
  );
}
