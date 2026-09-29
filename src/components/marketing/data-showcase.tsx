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
 *
 * Achado de auditoria (28/09/2026): duas entradas usavam `kind:
 * "ASSIGNMENT_CHANGED"` pra descrever "brinde emitido"/"brinde resgatado" —
 * eventos que NUNCA aparecem no feed ao vivo de verdade (`listRecentEvents`
 * só lê `RedirectLog`/`RatingEvent`/`PrivateFeedback`/`AuditLog`; Voucher não
 * é uma fonte do Live Mode hoje). Rotulado "o mesmo feed do seu painel", mas
 * mostrando um tipo de evento que o painel nunca mostra — o oposto de Zero
 * Fake Demo. `RATING` também saiu: desde a ADR-080 a tela pública não pede
 * mais nota, então esse evento é raríssimo (só links de antes da mudança).
 * Trocado por variações de `REDIRECT`/`FEEDBACK`/`ASSIGNMENT_CHANGED` que
 * genuinamente disparam hoje.
 */
const SAMPLE_ENTRIES: Omit<LiveFeedEntry, "id">[] = [
  { kind: "REDIRECT", message: "Mesa 4 abriu Instagram", timestamp: "agora" },
  { kind: "REDIRECT", message: "Mesa 9 abriu avaliação padrão", timestamp: "há 12s" },
  { kind: "FEEDBACK", message: "Balcão deixou um feedback privado", timestamp: "há 38s" },
  { kind: "REDIRECT", message: "Mesa 2 abriu WhatsApp", timestamp: "há 1min" },
  { kind: "ASSIGNMENT_CHANGED", message: "Atribuiu a campanha", timestamp: "há 2min" },
  { kind: "REDIRECT", message: "Mesa 15 abriu avaliação padrão", timestamp: "há 3min" },
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
