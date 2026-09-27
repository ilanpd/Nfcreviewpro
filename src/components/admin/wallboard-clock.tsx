"use client";

import { useEffect, useState } from "react";

/** Relógio ao vivo do Modo Executivo — confirma pra quem está olhando de
 * longe que a tela não travou, sem depender do SSE da Timeline pra isso.
 * Começa `null` e só resolve no cliente (`useEffect`) para nunca divergir
 * do HTML já enviado pelo servidor. */
export function WallboardClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="font-mono text-sm text-muted-foreground">{now ? now.toLocaleTimeString("pt-BR") : "--:--:--"}</span>;
}
