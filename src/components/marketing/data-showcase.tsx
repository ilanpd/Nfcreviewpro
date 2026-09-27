"use client";

import { useEffect, useState } from "react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { LiveEventFeed, type LiveFeedEntry } from "@nfc-os/ui";
import { BlurFade } from "@/components/ui/blur-fade";
import { usePrefersReducedMotion } from "@nfc-os/animations";

/**
 * "Os toques viram dados" (C12, ADR-087) — o maior ativo do Starter ainda
 * não tinha destaque visual próprio na home. Reaproveita o `LiveEventFeed`
 * de `@nfc-os/ui` — o MESMO componente que já roda de verdade no Live Mode/
 * Command Center do produto (nunca uma cópia visual só pra Landing parecer
 * viva) — alimentado aqui com entradas ilustrativas cicladas em loop,
 * sempre rotuladas como exemplo (Zero Fake Demo).
 */
const SAMPLE_ENTRIES: Omit<LiveFeedEntry, "id">[] = [
  { kind: "REDIRECT", message: "Mesa 4 — toque no cartão, avaliação no Google", timestamp: "agora" },
  { kind: "ASSIGNMENT_CHANGED", message: "Brinde do Retorno emitido — código K7X-4QM", timestamp: "há 12s" },
  { kind: "RATING", message: "Balcão — avaliação 5 estrelas registrada", timestamp: "há 38s" },
  { kind: "FEEDBACK", message: "Cliente insatisfeito falou direto no WhatsApp", timestamp: "há 1min" },
  { kind: "REDIRECT", message: "Mesa 9 — toque no cartão, avaliação no Google", timestamp: "há 2min" },
  { kind: "ASSIGNMENT_CHANGED", message: "Brinde resgatado no balcão — PIN confirmado", timestamp: "há 3min" },
];

export function DataShowcase() {
  const reducedMotion = usePrefersReducedMotion();
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (reducedMotion) {
      setCount(SAMPLE_ENTRIES.length);
      return;
    }
    const interval = setInterval(() => {
      setCount((c) => (c >= SAMPLE_ENTRIES.length ? 1 : c + 1));
    }, 2200);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const visibleEntries: LiveFeedEntry[] = SAMPLE_ENTRIES.slice(0, count)
    .map((e, i) => ({ ...e, id: `sample-${i}` }))
    .reverse();

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <BlurFade inView>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">O maior ativo do Starter</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Cada toque deixa de ser invisível — e vira inteligência para o seu negócio
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Um QR Code comum não conta nada sobre quem passou por ali. Todo toque no cartão Pulse vira um registro:
            quando aconteceu, o que a pessoa viu, se voltou depois. É o mesmo painel que aparece no seu Dashboard,
            ao vivo, desde o primeiro dia.
          </p>
          <div className="mt-8 flex items-baseline gap-2">
            <NumberTicker value={1284} className="text-4xl font-semibold tracking-tight text-foreground" />
            <span className="text-sm text-muted-foreground">toques registrados este mês (exemplo ilustrativo)</span>
          </div>
        </BlurFade>

        <BlurFade delay={0.1} inView>
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-premium">
            <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Exemplo ilustrativo — o mesmo feed do seu painel
            </p>
            <div className="min-h-[280px]">
              <LiveEventFeed entries={visibleEntries} />
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
