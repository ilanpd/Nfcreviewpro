"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { cn } from "@/lib/utils";

/**
 * Ponte entre o `next-themes` (fonte da verdade — persiste em localStorage,
 * evita flash incorreto no primeiro paint via o script que injeta antes da
 * hidratação) e o `AnimatedThemeToggler` do Magic UI (só cuida da transição
 * visual via View Transitions API). Nunca deixamos o toggler decidir tema
 * sozinho — por isso sempre em modo controlado (`theme`/`onThemeChange`).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // O tema real só existe no cliente (next-themes lê localStorage) — evita
  // um flash de ícone errado entre o HTML estático do servidor e a hidratação.
  useEffect(() => setMounted(true), []);

  return (
    <AnimatedThemeToggler
      theme={mounted && resolvedTheme === "dark" ? "dark" : "light"}
      onThemeChange={(next) => setTheme(next)}
      duration={500}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4",
        className
      )}
      aria-label="Alternar tema claro/escuro"
    />
  );
}
