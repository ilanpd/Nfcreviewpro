"use client";

import { useEffect, useState } from "react";
import type { Variants } from "framer-motion";
import { motion as motionTokens } from "@nfc-os/design-tokens";

/**
 * NFC OS Design Language — motion system.
 *
 * Uma linguagem de movimento única para o produto inteiro: os mesmos
 * variants do Framer Motion reaproveitados por todo componente premium de
 * `packages/ui`, em vez de props de animação ad-hoc espalhadas por cada
 * arquivo. "Toda animação comunica estado" (ver MANIFESTO_DO_DESIGN.md) —
 * cada variant abaixo existe porque marca uma transição de estado real
 * (apareceu, sumiu, foi selecionado), nunca decoração pura.
 */

/** Verdadeiro quando o usuário pediu `prefers-reduced-motion: reduce` — todo
 * componente animado deve consultar isto (ou confiar no CSS global de
 * `globals.css`, que já zera durações) antes de rodar uma animação JS que o
 * CSS sozinho não consegue neutralizar (ex.: `AnimatePresence`). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  return reduced;
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: motionTokens.duration.base, ease: motionTokens.easing.enter } },
  exit: { opacity: 0, transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.exit } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: motionTokens.duration.base, ease: motionTokens.easing.spring },
  },
  exit: { opacity: 0, scale: 0.98, transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.exit } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.base, ease: motionTokens.easing.enter } },
  exit: { opacity: 0, y: 8, transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.exit } },
};

export const slideInFromRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: motionTokens.duration.base, ease: motionTokens.easing.enter } },
  exit: { opacity: 0, x: 16, transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.exit } },
};

/** Lista com stagger — cada item usa `fadeIn`/`slideUp` como variant filho. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

/** Um "pop" breve de confirmação — usado no pulso de sucesso do Mapa de
 * Mesas (Fase 5) e reaproveitado por Badge Inteligente/Toast premium. */
export const successPop: Variants = {
  rest: { scale: 1 },
  pop: { scale: [1, 1.12, 1], transition: { duration: motionTokens.duration.slow, ease: motionTokens.easing.spring } },
};

export const hoverLift = {
  rest: { y: 0, boxShadow: "var(--shadow-subtle)" },
  hover: {
    y: -2,
    boxShadow: "var(--shadow-elevated)",
    transition: motionTokens.springs.gentle,
  },
};

export const pressScale = {
  rest: { scale: 1 },
  press: { scale: 0.97, transition: motionTokens.springs.snappy },
};

export { motionTokens };
