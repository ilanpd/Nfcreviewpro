"use client";

import { useState } from "react";
import { Star, Camera, MessageCircle, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PresetKind = "google" | "instagram" | "whatsapp" | "other";

const PRESETS: { kind: PresetKind; label: string; icon: typeof Star }[] = [
  { kind: "google", label: "Avaliação Google", icon: Star },
  { kind: "instagram", label: "Instagram", icon: Camera },
  { kind: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { kind: "other", label: "Outro link", icon: Link2 },
];

/**
 * Detecta o preset e o "handle" (@usuário/telefone) a partir de uma URL já
 * existente — achado de auditoria (28/09/2026): `meu-cartao-form.tsx` (o
 * portal de autoatendimento do cliente GUEST) reaproveitou este componente
 * pra trocar de link depois de já ter um, mas sem isto todo destino existente
 * (mesmo um Instagram) cairia sempre em "Outro link" com a URL crua — a
 * mesma fricção que este componente foi criado pra eliminar no checkout,
 * agora reaparecendo na edição. No checkout `value` sempre começa vazio, então
 * o comportamento de lá não muda (cai em "other" do mesmo jeito).
 */
export function detectPreset(url: string): { preset: PresetKind; handle: string } {
  if (!url) return { preset: "other", handle: "" };
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("instagram.com")) {
      return { preset: "instagram", handle: parsed.pathname.replace(/^\/|\/$/g, "") };
    }
    if (parsed.hostname === "wa.me") {
      return { preset: "whatsapp", handle: parsed.pathname.replace(/^\//, "") };
    }
    if (parsed.hostname.endsWith("g.page") || parsed.hostname.includes("google.")) {
      return { preset: "google", handle: "" };
    }
  } catch {
    // URL inválida/vazia: cai no padrão abaixo.
  }
  return { preset: "other", handle: "" };
}

/**
 * UX (Auditoria Nível Bilionário, 11/09/2026) — antes deste componente, o
 * checkout inteiro (loja avulsa e checkout combinado) pedia uma URL crua
 * (`https://...`), pressupondo que o comprador sabe o que é uma URL e já
 * tem o link copiado em algum lugar. Identificado como o maior ponto de
 * atrito do fluxo para um usuário menos técnico. Instagram/WhatsApp agora
 * pedem só o dado que a pessoa realmente tem de cabeça (@usuário, número de
 * telefone) — o link é montado por trás. Avaliação Google continua sendo
 * colar um link (não existe alternativa mais simples sem uma integração
 * com a API do Google Places, fora de escopo aqui).
 */
export function DestinationPicker({
  value,
  onChange,
  label = "Para onde seus cartões devem redirecionar?",
  helperText = "Configuramos os cartões com esse destino antes do envio — depois de receber, você recebe um link pessoal para trocar sozinho, sem precisar de conta.",
}: {
  value: string;
  onChange: (url: string) => void;
  /** Plural por padrão (compra, sempre mais de um "cartão" possível) — mas
   * `meu-cartao-form.tsx` reaproveita este componente pra editar UM cartão
   * específico já existente, onde o plural soaria estranho. */
  label?: string;
  helperText?: string;
}) {
  const [preset, setPreset] = useState<PresetKind>(() => detectPreset(value).preset);
  const [handle, setHandle] = useState<string>(() => detectPreset(value).handle);

  function selectPreset(kind: PresetKind) {
    setPreset(kind);
    setHandle("");
    if (kind === "google") onChange("");
    else onChange("");
  }

  function updateHandle(raw: string) {
    setHandle(raw);
    if (preset === "instagram") {
      const clean = raw.trim().replace(/^@/, "");
      onChange(clean ? `https://instagram.com/${clean}` : "");
    } else if (preset === "whatsapp") {
      const digits = raw.replace(/\D/g, "");
      onChange(digits ? `https://wa.me/${digits}` : "");
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="destination-input">{label}</Label>
      {/* `role="group"` + `aria-pressed`: mesmo achado de acessibilidade do
          seletor de quantidade em onboarding/plan/plan-selector.tsx — sem
          isso, um leitor de tela não sabia qual preset estava ativo. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de destino">
        {PRESETS.map((p) => (
          <button
            key={p.kind}
            type="button"
            onClick={() => selectPreset(p.kind)}
            aria-pressed={preset === p.kind}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              preset === p.kind ? "border-brand bg-brand text-brand-foreground" : "hover:bg-muted"
            )}
          >
            <p.icon className="size-3.5" aria-hidden="true" /> {p.label}
          </button>
        ))}
      </div>

      {preset === "instagram" ? (
        <Input id="destination-input" placeholder="@seuinstagram" value={handle} onChange={(e) => updateHandle(e.target.value)} />
      ) : preset === "whatsapp" ? (
        <Input
          id="destination-input"
          placeholder="DDD + número (só números)"
          inputMode="numeric"
          value={handle}
          onChange={(e) => updateHandle(e.target.value)}
        />
      ) : (
        <Input
          id="destination-input"
          type="url"
          placeholder={preset === "google" ? "https://g.page/r/xxxxx/review" : "https://..."}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="text-xs text-muted-foreground">{helperText}</p>
    </div>
  );
}
