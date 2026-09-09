"use client";

import { useState } from "react";
import { AnalyticsCard, SmartBadge } from "@nfc-os/ui";
import { ShieldCheck } from "lucide-react";

type AutoPilotLevel = "MANUAL" | "RECOMMENDED" | "SEMI_AUTOMATIC" | "AUTOMATIC";

const LEVELS: { value: AutoPilotLevel; label: string; description: string }[] = [
  { value: "MANUAL", label: "Manual", description: "O sistema só sugere — você aplica tudo, sempre." },
  { value: "RECOMMENDED", label: "Recomendado", description: "Igual ao Manual, com mais destaque para o que vale a pena agora." },
  { value: "SEMI_AUTOMATIC", label: "Semi-automático", description: "Playbooks seguros de alta confiança são agendados com uma janela de 15 min para cancelar." },
  { value: "AUTOMATIC", label: "Automático", description: "Playbooks seguros de alta confiança são aplicados sozinhos, sempre com log completo e Desfazer disponível." },
];

/**
 * AutoPilot Seguro (Fase 11) — a UI da Autonomy Review: cada nível deixa
 * explícito o que muda em "o sistema age sozinho?" antes de ser escolhido,
 * nunca um toggle binário "ligar automação" sem explicação.
 */
export function AutoPilotSelector({ initialLevel, canManage }: { initialLevel: AutoPilotLevel; canManage: boolean }) {
  const [level, setLevel] = useState(initialLevel);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: AutoPilotLevel) {
    if (!canManage || saving) return;
    setSaving(true);
    const previous = level;
    setLevel(next);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: next }),
      });
      if (!res.ok) setLevel(previous);
    } catch {
      setLevel(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnalyticsCard
      title="AutoPilot"
      description="Quanto o sistema pode agir sozinho — sempre com log completo e Desfazer."
      action={<SmartBadge label={LEVELS.find((l) => l.value === level)?.label ?? level} tone="brand" icon={<ShieldCheck />} />}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {LEVELS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={!canManage}
            onClick={() => handleChange(option.value)}
            className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              level === option.value ? "border-brand bg-brand-subtle" : "border-border/60 hover:bg-muted"
            }`}
          >
            <p className="text-xs font-semibold text-foreground">{option.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{option.description}</p>
          </button>
        ))}
      </div>
      {!canManage ? <p className="mt-3 text-[11px] text-muted-foreground">Somente Proprietário/Administrador pode alterar o nível de AutoPilot.</p> : null}
    </AnalyticsCard>
  );
}
