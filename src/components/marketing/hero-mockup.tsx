"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Gift, Nfc, Smartphone } from "lucide-react";
import { motionTokens, usePrefersReducedMotion } from "@nfc-os/animations";
import { formatVoucherCode } from "@/domain/return-offer/code";
import { cn } from "@/lib/utils";
import { PhoneFrame } from "./phone-frame";

type Phase = "approach" | "tap" | "reveal" | "redeem" | "success" | "redirect";
type Flow = "avulso" | "starter";

interface Beat {
  phase: Phase;
  duration: number;
}

// Roteiro real de cada fluxo (C15) — não é mais um "resultado" único: reflete
// exatamente `src/app/r/[code]/card-screen.tsx`. No Starter, o código do
// brinde já aparece revelado (nunca escondido atrás de uma escolha prévia) e
// o botão de destino continua sempre visível junto — o único passo realmente
// sequencial é o resgate (PIN da loja → sucesso). No avulso, sem Retorno
// ativo, o toque é um redirecionamento HTTP direto — por isso a cena fica
// curta de propósito, sem inventar uma tela que o produto não mostra.
const SEQUENCES: Record<Flow, Beat[]> = {
  starter: [
    { phase: "approach", duration: 1400 },
    { phase: "tap", duration: 550 },
    { phase: "reveal", duration: 2600 },
    { phase: "redeem", duration: 2000 },
    { phase: "success", duration: 2000 },
  ],
  avulso: [
    { phase: "approach", duration: 1400 },
    { phase: "tap", duration: 550 },
    { phase: "redirect", duration: 2400 },
  ],
};

// Com `prefers-reduced-motion`, cada fluxo trava no quadro mais informativo
// (o argumento de venda), nunca no meio de uma transição.
const FROZEN_STEP: Record<Flow, number> = { starter: 2, avulso: 2 };

const FLOW_LABELS: { id: Flow; label: string }[] = [
  { id: "starter", label: "Plano Starter" },
  { id: "avulso", label: "Cartão avulso" },
];

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

/** Os 4 pontinhos do PIN preenchendo um a um — só decorativo, nunca lê nem grava nada de verdade. */
function PinDots() {
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    if (filled >= 4) return;
    const timer = setTimeout(() => setFilled((f) => f + 1), 240);
    return () => clearTimeout(timer);
  }, [filled]);
  return (
    <div className="flex items-center justify-center gap-1.5 py-0.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full border transition-colors duration-150",
            i < filled ? "border-brand bg-brand" : "border-white/25 bg-transparent"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Conteúdo da "tela do celular" para cada fase — o argumento de venda inteiro
 * mora aqui. É uma função pura (não um componente JSX chamado como
 * `<PhaseContent/>`) de propósito: `AnimatePresence` só rastreia
 * corretamente entrada/saída de quem é seu FILHO DIRETO — um componente
 * wrapper entre `<AnimatePresence>` e o `motion.div` real (mesmo repassando
 * a `key` pra ele) já causou, na prática, fases anteriores ficarem
 * "grudadas" na tela ao trocar de fluxo. Chamar como função devolve o
 * `motion.div` como filho direto de verdade.
 */
function phaseContent(flowId: Flow, phase: Phase) {
  if (phase === "approach" || phase === "tap") {
    return (
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
    );
  }

  const enter = { opacity: 0, y: 8, scale: 0.94 };
  const center = { opacity: 1, y: 0, scale: 1 };
  const leave = { opacity: 0, y: -6 };
  const transition = { duration: motionTokens.duration.slow, ease: motionTokens.easing.spring };

  if (phase === "reveal") {
    return (
      <motion.div
        key={`${flowId}-reveal`}
        initial={enter}
        animate={center}
        exit={leave}
        transition={transition}
        className="w-full space-y-1.5 rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-left"
      >
        <div className="flex items-center gap-1.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <Gift className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[8px] font-medium uppercase tracking-wide text-brand">Brinde liberado</p>
            <p className="truncate text-[10px] font-semibold leading-tight text-white">Sobremesa grátis</p>
          </div>
        </div>
        <div className="rounded-md bg-black/30 px-2 py-1.5 text-center">
          <p className="font-mono text-xs font-semibold tracking-[0.15em] text-white">{formatVoucherCode("K7X4QM")}</p>
        </div>
        <div className="rounded-md bg-brand px-2 py-1 text-center text-[9px] font-semibold text-brand-foreground">Resgatar agora</div>
        <p className="pt-0.5 text-center text-[8px] leading-tight text-white/35">ou avalie no Google, quando quiser</p>
      </motion.div>
    );
  }

  if (phase === "redeem") {
    return (
      <motion.div
        key={`${flowId}-redeem`}
        initial={enter}
        animate={center}
        exit={leave}
        transition={transition}
        className="w-full space-y-1 rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-center"
      >
        <p className="text-[10px] font-semibold text-white">Confirme o resgate</p>
        <p className="text-[8px] leading-tight text-white/45">Peça pro atendente digitar o PIN</p>
        <PinDots />
        <div className="rounded-md bg-brand px-2 py-1 text-[9px] font-semibold text-brand-foreground">Confirmar resgate</div>
      </motion.div>
    );
  }

  if (phase === "success") {
    return (
      <motion.div
        key={`${flowId}-success`}
        initial={enter}
        animate={center}
        exit={leave}
        transition={transition}
        className="flex w-full flex-col items-center gap-1 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-center"
      >
        <CheckCircle2 className="size-5 text-emerald-400" strokeWidth={1.75} />
        <p className="text-[10px] font-semibold text-white">Brinde resgatado</p>
        <p className="text-[8px] text-white/50">Obrigado pela visita!</p>
      </motion.div>
    );
  }

  // redirect (avulso): sem Retorno ativo, o toque é um redirecionamento HTTP
  // direto — nenhuma tela intermediária é renderizada de verdade, por isso a
  // cena é só um lampejo do destino real, nunca uma tela cheia de estrelas.
  return (
    <motion.div
      key={`${flowId}-redirect`}
      initial={enter}
      animate={center}
      exit={leave}
      transition={transition}
      className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-center"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-white p-1">
        <GoogleG className="size-full" />
      </span>
      <p className="text-[10px] font-semibold leading-tight text-white">
        Avaliação
        <span className="block font-normal text-white/45">direto no Google</span>
      </p>
      <div className="flex items-center gap-1 text-[8px] text-white/35">
        <ExternalLink className="size-2.5" />
        Sem tela extra — direto pro destino
      </div>
    </motion.div>
  );
}

/**
 * O mockup vivo do Hero (C11/C12/C15, ADR-086/087/089) — não é um vídeo
 * (nenhum roteiro, ator ou gravação existe ainda), é uma cena real do que a
 * animação promete mostrar. Reescrita no C15 pra parar de simplificar o
 * fluxo do Starter como "toque → brinde": agora reproduz exatamente
 * `src/app/r/[code]/card-screen.tsx` — o código do brinde revelado de
 * imediato (nunca atrás de uma escolha prévia), com o botão de destino
 * sempre coexistindo, e o único passo realmente sequencial (resgate com PIN
 * na loja) como o clímax visual da cena. O fluxo avulso permanece curto de
 * propósito: sem Retorno ativo, o toque é um redirecionamento HTTP direto,
 * sem tela própria — encurtar essa cena é honestidade, não preguiça. Loop
 * por `setTimeout` encadeado (evita drift de `setInterval`); com
 * `prefers-reduced-motion`, trava no quadro mais informativo de cada fluxo.
 */
export function HeroMockup() {
  const reducedMotion = usePrefersReducedMotion();
  const [flowId, setFlowId] = useState<Flow>("starter");
  const [step, setStep] = useState(reducedMotion ? FROZEN_STEP.starter : 0);
  const sequence = SEQUENCES[flowId];
  const beat = sequence[step] ?? sequence[0];
  const phase = beat.phase;

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => setStep((s) => (s + 1) % sequence.length), beat.duration);
    return () => clearTimeout(timer);
  }, [step, sequence, beat.duration, reducedMotion]);

  function selectFlow(id: Flow) {
    if (id === flowId) return;
    setFlowId(id);
    setStep(reducedMotion ? FROZEN_STEP[id] : 0);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-1.5 rounded-full border border-border/60 bg-muted/40 p-1">
        {FLOW_LABELS.map((f) => (
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
          <PhoneFrame className="h-64 w-32 sm:h-72 sm:w-36">
            <AnimatePresence mode="wait">{phaseContent(flowId, phase)}</AnimatePresence>
          </PhoneFrame>

          {/* Cartão físico — só visível durante approach/tap; nas fases seguintes já "entrou" no celular. */}
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
                ? { duration: SEQUENCES[flowId][0].duration / 1000, ease: motionTokens.easing.standard }
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
