"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";

/** Fechamento da home: um bloco escuro chapado com um único botão âmbar.
 * Sem partículas, feixes nem varredura de cor no título (ADR-077). */
export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <BlurFade inView offset={16}>
        <div className="rounded-2xl bg-noc-surface px-8 py-20 text-center text-white sm:px-16">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Pronto para transformar sua reputação online?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Configure sua empresa em minutos e receba seu primeiro cartão NFC pronto para uso.
          </p>
          <div className="mt-8 inline-block">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Começar grátis
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </BlurFade>
    </section>
  );
}
