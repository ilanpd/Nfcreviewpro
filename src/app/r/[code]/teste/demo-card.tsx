"use client";

import { useState } from "react";
import { CardScreen } from "../card-screen";
import { PUBLIC_STATES } from "@/domain/return-offer/public-screen";

interface DemoCardProps {
  code: string;
  company: { name: string; logoUrl: string | null; primaryColor: string };
  primaryUrl: string;
  title: string;
  timeZone: string;
  windowDays: number;
  nowIso: string;
}

/** Como cada estado simulável é montado na tela real: qual resposta e qual painel já aberto. */
const SETUP: Record<string, { stateId: string; mode?: "BUTTONS"; autoOverlay?: "entry" | "redeem"; autoCode?: string; autoPin?: string }> = {
  OTHER_DEVICE: { stateId: "COOLDOWN_QUIET", autoOverlay: "entry" },
  INVALID_CODE: { stateId: "COOLDOWN_QUIET", autoOverlay: "entry", autoCode: "ZZZ-ZZZ" },
  WRONG_PIN: { stateId: "READY", autoOverlay: "redeem", autoPin: "0000" },
  PAUSED: { stateId: "PAUSED", mode: "BUTTONS" },
};

/**
 * O modo de teste do dono (ADR-080): a MESMA tela do cliente, escolhendo o estado
 * a simular. Nada é gravado e nenhum brinde é emitido. No teste, o PIN 0000
 * simula erro e qualquer outro confirma; o código de exemplo é K7X-4QM.
 */
export function DemoCard(props: DemoCardProps) {
  const states = PUBLIC_STATES.filter((s) => s.demo);
  const [selected, setSelected] = useState(states[0].id);
  const setup = SETUP[selected] ?? { stateId: selected };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div role="note" className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-50">
        <p className="font-medium">Modo de teste</p>
        <p className="mt-1 text-xs opacity-80">
          Nada é gravado e nenhum brinde é emitido. PIN 0000 simula erro; qualquer outro confirma. Código de exemplo: K7X-4QM.
        </p>
      </div>

      <nav aria-label="Estados da tela" className="flex flex-wrap gap-2">
        {states.map((state) => (
          <button
            key={state.id}
            type="button"
            onClick={() => setSelected(state.id)}
            aria-pressed={selected === state.id}
            title={state.how}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected === state.id ? "border-transparent bg-foreground text-background" : "border-border bg-background hover:bg-muted"
            }`}
          >
            {state.n}. {state.label}
          </button>
        ))}
      </nav>

      <div className="rounded-3xl border border-border bg-background p-6 shadow-elevated">
        <CardScreen
          key={selected}
          code={props.code}
          company={props.company}
          mode={setup.mode ?? "RETURN"}
          primaryUrl={props.primaryUrl}
          demo={{
            stateId: setup.stateId,
            title: props.title,
            timeZone: props.timeZone,
            windowDays: props.windowDays,
            nowIso: props.nowIso,
            autoOverlay: setup.autoOverlay,
            autoCode: setup.autoCode,
            autoPin: setup.autoPin,
          }}
        />
      </div>
    </div>
  );
}
