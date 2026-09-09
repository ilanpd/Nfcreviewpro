/**
 * NFC OS Design Language — tokens de design.
 *
 * A fonte da verdade para COR, RADIUS e SOMBRA continua sendo o CSS
 * (`src/app/globals.css`, via `@theme` do Tailwind v4) — é lá que qualquer
 * classe utilitária (`bg-primary`, `rounded-xl`, `shadow-elevated`) resolve
 * de fato. Este arquivo existe para os valores que só fazem sentido em
 * JavaScript: durações/easings do Framer Motion (que recebe números/strings,
 * não `var(--duration-base)`), a escala de z-index (para lógica condicional
 * de empilhamento) e os breakpoints (para `matchMedia`/hooks). Nenhum valor
 * aqui deveria divergir do que está em `globals.css` — quando os dois
 * precisarem do mesmo número, este arquivo é quem lê de lá, nunca o
 * contrário. Ver ADR-022 para por que isto é uma pasta com alias de import,
 * não um pacote npm publicável de verdade.
 */

export const motion = {
  duration: {
    instant: 0.1,
    fast: 0.15,
    base: 0.2,
    slow: 0.32,
    slower: 0.48,
  },
  easing: {
    /** Padrão para a maioria das transições de UI — entra rápido, termina suave. */
    standard: [0.4, 0, 0.2, 1] as const,
    /** Saída de um elemento (fecha, sai da tela). */
    exit: [0.4, 0, 1, 1] as const,
    /** Entrada de um elemento (abre, aparece). */
    enter: [0, 0, 0.2, 1] as const,
    /** Um leve "overshoot" para confirmações e pops — usar com moderação. */
    spring: [0.34, 1.56, 0.64, 1] as const,
  },
  /** Spring do Framer Motion para hover/press de componentes interativos —
   * mais "vivo" que uma curva de bezier, sem ser exagerado. */
  springs: {
    snappy: { type: "spring" as const, stiffness: 500, damping: 30 },
    gentle: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
} as const;

export const zIndex = {
  dropdown: 50,
  sticky: 60,
  overlay: 70,
  modal: 80,
  popover: 90,
  tooltip: 100,
  toast: 110,
  commandPalette: 120,
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type MotionDurationKey = keyof typeof motion.duration;
export type MotionEasingKey = keyof typeof motion.easing;
