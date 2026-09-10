"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { motionTokens, usePrefersReducedMotion } from "@nfc-os/animations";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

/**
 * Camada proprietária do NFC OS Design Language (Fase 14) — nunca um
 * segundo `Button`. Envolve o `Button` do shadcn (único canônico, ver
 * MANIFESTO_DO_DESIGN.md Princípio 6) com um deslocamento físico em
 * direção ao cursor dentro de um raio pequeno — a interação "magnética"
 * pedida nas referências, sem recriar variantes/tamanhos que o Button já
 * resolve. Reservado para no máximo uma ação por tela (Princípio 1) — o
 * efeito em si marca "esta é a ação principal", nunca decoração solta.
 */
export function MagneticButton({
  children,
  strength = 14,
  radius = 80,
  ...buttonProps
}: React.ComponentProps<typeof Button> &
  VariantProps<typeof buttonVariants> & {
    children: React.ReactNode;
    /** Deslocamento máximo em px — mantém o efeito "físico", nunca exagerado. */
    strength?: number;
    /** Raio em px, a partir do centro do botão, onde o efeito começa a agir. */
    radius?: number;
  }) {
  const ref = useRef<HTMLButtonElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, motionTokens.springs.gentle);
  const springY = useSpring(y, motionTokens.springs.gentle);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    const distance = Math.hypot(distanceX, distanceY);
    const effectiveRadius = radius + rect.width / 2;

    if (distance < effectiveRadius) {
      const pull = 1 - distance / effectiveRadius;
      x.set((distanceX / effectiveRadius) * strength * pull);
      y.set((distanceY / effectiveRadius) * strength * pull);
    } else {
      x.set(0);
      y.set(0);
    }
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      style={reducedMotion ? undefined : { x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="inline-block"
    >
      <Button ref={ref} {...buttonProps}>
        {children}
      </Button>
    </motion.div>
  );
}
