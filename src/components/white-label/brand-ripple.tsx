"use client";

import { useRef } from "react";
import { cn } from "cn";

/**
 * Brand Motion System (Fase 10, bônus) — um ripple automático na cor da
 * marca, sem nenhuma configuração: envolva qualquer elemento clicável
 * (`<BrandRipple><Button>...</Button></BrandRipple>`) e o ponto exato do
 * clique ganha um pulso sutil na cor de `--brand-primary` (ver a classe
 * `.brand-ripple` em `globals.css`). Puramente decorativo — nunca
 * intercepta o clique real, que continua chegando ao filho normalmente.
 */
export function BrandRipple({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  function handleClick(e: React.MouseEvent<HTMLSpanElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--ripple-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--ripple-y", `${e.clientY - rect.top}px`);
    el.classList.remove("is-rippling");
    // força reflow para reiniciar a animação em cliques seguidos no mesmo ponto
    void el.offsetWidth;
    el.classList.add("is-rippling");
  }

  return (
    <span ref={ref} onClickCapture={handleClick} className={cn("brand-ripple inline-block", className)}>
      {children}
    </span>
  );
}
