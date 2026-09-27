"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Nfc, Smartphone, Star } from "lucide-react";
import { motionTokens, usePrefersReducedMotion } from "@nfc-os/animations";
import { formatVoucherCode } from "@/domain/return-offer/code";

type Phase = "approach" | "tap" | "result";

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

/**
 * O mockup vivo do Hero (C11, ADR-086) — não é um vídeo (nenhum roteiro,
 * ator ou gravação existe ainda para o produto), é uma cena real do que a
 * animação promete mostrar: o cartão encosta no celular, o motor resolve, o
 * brinde do Retorno aparece. Substitui o antigo placeholder "vídeo em breve"
 * — uma caixa vazia nunca comunica o produto; esta cena, sim. Loop de 3
 * fases (aproxima → toque → resultado) via `setTimeout` encadeado, nunca um
 * `setInterval` fixo (evita drift entre o tempo real da transição e o
 * próximo disparo). Com `prefers-reduced-motion`, para no quadro do
 * resultado — a cena mais informativa, parada.
 */
export function HeroMockup() {
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(reducedMotion ? "result" : "approach");

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => setPhase((p) => NEXT_PHASE[p]), PHASE_DURATIONS[phase]);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion]);

  const code = formatVoucherCode("K7X4QM");

  return (
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
                  key="result"
                  initial={{ opacity: 0, y: 8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.spring }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.06] p-2.5 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                      <Gift className="size-3.5" />
                    </span>
                    <p className="text-[10px] font-semibold leading-tight text-white">
                      Brinde
                      <span className="block font-normal text-white/45">próxima visita</span>
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-md border border-dashed border-white/15 px-1.5 py-1">
                    <span className="font-mono text-[9px] font-semibold tracking-wide text-white/90">{code}</span>
                    <Star className="size-2.5 fill-brand text-brand" />
                  </div>
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
  );
}
