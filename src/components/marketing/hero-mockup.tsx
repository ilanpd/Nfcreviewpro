"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Nfc, Smartphone, Star } from "lucide-react";
import { motionTokens, usePrefersReducedMotion } from "@nfc-os/animations";
import { formatVoucherCode } from "@/domain/return-offer/code";
import { cn } from "@/lib/utils";

type Phase = "approach" | "tap" | "result";
type Flow = "avulso" | "starter";

const PHASE_DURATIONS: Record<Phase, number> = {
  approach: 1400,
  tap: 550,
  result: 2600,
};

const NEXT_PHASE: Record<Phase, Phase> = {
  approach: "tap",
  tap: "result",
  result: "approach",
};

function GoogleG({ className }: { className?: string }) {
  // Ícone oficial do Google ("G" colorido) — SVG inline, sem dependência
  // externa; é o destino real do fluxo avulso (avaliação no Google), nunca
  // um genérico "check" que fingiria não saber pra onde vai.
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.9 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

const FLOWS: {
  id: Flow;
  label: string;
  result: { icon: React.ReactNode; title: string; subtitle: string; footer: React.ReactNode };
}[] = [
  {
    id: "starter",
    label: "Plano Starter",
    result: {
      icon: (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Gift className="size-3.5" />
        </span>
      ),
      title: "Brinde",
      subtitle: "próxima visita",
      footer: (
        <div className="mt-2 flex items-center justify-between rounded-md border border-dashed border-white/15 px-1.5 py-1">
          <span className="font-mono text-[9px] font-semibold tracking-wide text-white/90">{formatVoucherCode("K7X4QM")}</span>
          <Star className="size-2.5 fill-brand text-brand" />
        </div>
      ),
    },
  },
  {
    id: "avulso",
    label: "Cartão avulso",
    result: {
      icon: (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white p-1">
          <GoogleG className="size-full" />
        </span>
      ),
      title: "Avaliação",
      subtitle: "direto no Google",
      footer: (
        <div className="mt-2 flex items-center gap-0.5 rounded-md border border-dashed border-white/15 px-1.5 py-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-3 fill-amber-400 text-amber-400" />
          ))}
        </div>
      ),
    },
  },
];

/**
 * O mockup vivo do Hero (C11/C12, ADR-086/087) — não é um vídeo (nenhum
 * roteiro, ator ou gravação existe ainda), é uma cena real do que a
 * animação promete mostrar. Duas versões de verdade, alternáveis (C12):
 * "Cartão avulso" (sem assinatura — o toque leva direto pra avaliação no
 * Google, o argumento de venda do produto mais simples) e "Plano Starter"
 * (a experiência Pulse completa, com o brinde do Retorno). Nunca uma
 * animação fictícia — as duas refletem exatamente `decideCardExperience`
 * (domain/return-offer/experience.ts): sem Retorno ativo, o destino
 * primário é sempre o botão configurado (Google, no caso mais comum).
 * Loop de 3 fases por `setTimeout` encadeado (evita drift de `setInterval`);
 * com `prefers-reduced-motion`, para no quadro do resultado.
 */
export function HeroMockup() {
  const reducedMotion = usePrefersReducedMotion();
  const [flowId, setFlowId] = useState<Flow>("starter");
  const [phase, setPhase] = useState<Phase>(reducedMotion ? "result" : "approach");
  const flow = FLOWS.find((f) => f.id === flowId)!;

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => setPhase((p) => NEXT_PHASE[p]), PHASE_DURATIONS[phase]);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion]);

  function selectFlow(id: Flow) {
    if (id === flowId) return;
    setFlowId(id);
    setPhase(reducedMotion ? "result" : "approach");
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-1.5 rounded-full border border-border/60 bg-muted/40 p-1">
        {FLOWS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => selectFlow(f.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              flowId === f.id ? "bg-brand text-brand-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative flex aspect-square w-full max-w-sm items-center justify-center sm:aspect-video sm:max-w-none">
        {/* Halo ambiente atrás da cena — mesma cor de marca, nunca decorativo à toa: marca "aqui acontece a ação". */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-[2.5rem] opacity-70 blur-2xl"
          style={{ background: "radial-gradient(60% 60% at 50% 45%, var(--brand) 0%, transparent 72%)", opacity: 0.16 }}
        />

        <div className="relative flex h-full w-full items-center justify-center gap-6 sm:gap-12">
          {/* Celular */}
          <div className="relative flex h-64 w-32 shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0A0A0C] shadow-premium sm:h-72 sm:w-36">
            <div aria-hidden className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/15" />
            <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3 pt-6">
              <AnimatePresence mode="wait">
                {phase !== "result" ? (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2 text-center"
                  >
                    <span className="relative flex size-9 items-center justify-center rounded-full bg-brand/20">
                      <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" style={{ animationDuration: "1.8s" }} />
                      <Smartphone className="relative size-4 text-brand" strokeWidth={1.75} />
                    </span>
                    <p className="text-[10px] leading-tight text-white/50">Aproxime o cartão…</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`result-${flow.id}`}
                    initial={{ opacity: 0, y: 8, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.spring }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] p-2.5 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      {flow.result.icon}
                      <p className="text-[10px] font-semibold leading-tight text-white">
                        {flow.result.title}
                        <span className="block font-normal text-white/45">{flow.result.subtitle}</span>
                      </p>
                    </div>
                    {flow.result.footer}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Cartão físico */}
          <motion.div
            className="absolute flex h-20 w-32 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[#1B1B1F] to-[#0A0A0C] shadow-elevated sm:h-24 sm:w-36"
            animate={
              reducedMotion
                ? { x: 0, y: 0, rotate: -6, opacity: 0 }
                : phase === "approach"
                  ? { x: 46, y: 34, rotate: -8, opacity: 1 }
                  : { x: 4, y: 2, rotate: -2, opacity: phase === "tap" ? 1 : 0 }
            }
            transition={
              phase === "approach"
                ? { duration: PHASE_DURATIONS.approach / 1000, ease: motionTokens.easing.standard }
                : { duration: motionTokens.duration.slow, ease: motionTokens.easing.spring }
            }
            style={{ right: "18%" }}
          >
            <Nfc className="size-6 text-brand" strokeWidth={1.5} />
            {phase === "tap" ? (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-xl border-2 border-brand"
                initial={{ opacity: 0.7, scale: 1 }}
                animate={{ opacity: 0, scale: 1.6 }}
                transition={{ duration: 0.5, ease: motionTokens.easing.exit }}
              />
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
