"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "cn";
import { motionTokens, usePrefersReducedMotion } from "@nfc-os/animations";

/**
 * Camada proprietária do NFC OS Design Language (Fase 14) — glow ambiente
 * de seção que segue o cursor, distinto do `MagicCard` (spotlight POR
 * CARTÃO, já instalado via Magic UI). Usado em superfícies grandes (Hero,
 * seções cinematográficas), nunca dentro de um card individual — os dois
 * não competem pelo mesmo trabalho.
 */
export function CursorGlow({
  children,
  className,
  color = "var(--brand)",
  size = 480,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, motionTokens.springs.gentle);
  const springY = useSpring(y, motionTokens.springs.gentle);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  }

  return (
    <div ref={ref} onMouseMove={handleMouseMove} className={cn("relative", className)}>
      {!reducedMotion ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -z-10 rounded-full blur-3xl"
          style={{
            width: size,
            height: size,
            left: springX,
            top: springY,
            x: "-50%",
            y: "-50%",
            background: `radial-gradient(circle, color-mix(in oklch, ${color} 22%, transparent) 0%, transparent 70%)`,
          }}
        />
      ) : null}
      {children}
    </div>
  );
}
