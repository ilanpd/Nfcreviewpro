"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STAGES = ["NFC", "Resolution Engine", "Event Bus", "Analytics", "Playbooks", "Command Center"];
const STAGE_X = STAGES.map((_, i) => 40 + i * ((760 - 80) / (STAGES.length - 1)));

/** Cada tipo real de evento mapeia para até onde no pipeline ele chega —
 * nunca todos os eventos "andam" o caminho inteiro, porque nem todo evento
 * de domínio realmente alcança Playbooks/Command Center hoje. */
const EVENT_REACH: Record<string, number> = {
  NFCTocado: 2,
  RedirecionamentoResolvido: 3,
  FeedbackRecebido: 3,
  AvaliacaoPublicada: 3,
  CampanhaCriada: 2,
  CampanhaAtualizada: 2,
  CampanhaEncerrada: 2,
  RecomendacaoGerada: 4,
  PlaybookExecutado: 5,
  PlaybookDesfeito: 4,
  ZonaAtualizada: 2,
  MesaAtualizada: 2,
  OrganizacaoAtualizada: 2,
};

interface FlowParticle {
  id: string;
  reach: number;
  type: string;
}

interface EventLogRow {
  id: string;
  type: string;
  createdAt: string;
}

/**
 * Visual Event Flow (Fase 12) — "partículas percorrendo NFC → Resolution
 * Engine → Event Bus → Analytics → Playbooks → Command Center. Sem
 * inventar dados." Cada partícula nasce de uma linha REAL de `EventLog`
 * (via polling de `/api/dev/events`, diffing por id) — nunca um timer
 * decorativo gerando partículas sozinho.
 */
export function VisualEventFlow() {
  const [particles, setParticles] = useState<FlowParticle[]>([]);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/dev/events");
        if (!res.ok || cancelled) return;
        const { events } = (await res.json()) as { events: EventLogRow[] };
        const fresh = events.filter((e) => !seenIds.current.has(e.id)).slice(0, 5);
        for (const e of fresh) seenIds.current.add(e.id);
        if (fresh.length > 0) {
          setParticles((prev) => [...prev, ...fresh.map((e) => ({ id: e.id, reach: EVENT_REACH[e.type] ?? 2, type: e.type }))].slice(-12));
        }
      } catch {
        // silencioso — o diagrama simplesmente não recebe uma partícula neste ciclo
      }
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md">
      <svg viewBox="0 0 800 90" className="h-24 w-full min-w-[640px]">
        <line x1={STAGE_X[0]} y1={45} x2={STAGE_X[STAGE_X.length - 1]} y2={45} stroke="var(--border)" strokeWidth={2} />
        {STAGES.map((label, i) => (
          <g key={label}>
            <circle cx={STAGE_X[i]} cy={45} r={6} fill="var(--brand)" />
            <text x={STAGE_X[i]} y={70} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
              {label}
            </text>
          </g>
        ))}
        <AnimatePresence>
          {particles.map((p) => (
            <motion.circle
              key={p.id}
              r={4}
              fill="var(--brand)"
              initial={{ cx: STAGE_X[0], cy: 45, opacity: 0 }}
              animate={{ cx: STAGE_X[p.reach], cy: 45, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2.2, ease: "easeInOut" }}
              onAnimationComplete={() => setParticles((prev) => prev.filter((x) => x.id !== p.id))}
            >
              <title>{p.type}</title>
            </motion.circle>
          ))}
        </AnimatePresence>
      </svg>
      {particles.length === 0 ? <p className="mt-1 text-center text-[11px] text-muted-foreground">Aguardando o próximo evento real…</p> : null}
    </div>
  );
}
