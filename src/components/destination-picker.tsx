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
export function DestinationPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [preset, setPreset] = useState<PresetKind>("other");
  const [handle, setHandle] = useState("");

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
      <Label>Para onde seus cartões devem redirecionar?</Label>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.kind}
            type="button"
            onClick={() => selectPreset(p.kind)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              preset === p.kind ? "border-brand bg-brand text-brand-foreground" : "hover:bg-muted"
            )}
          >
            <p.icon className="size-3.5" /> {p.label}
          </button>
        ))}
      </div>

      {preset === "instagram" ? (
        <Input placeholder="@seuinstagram" value={handle} onChange={(e) => updateHandle(e.target.value)} />
      ) : preset === "whatsapp" ? (
        <Input placeholder="DDD + número (só números)" inputMode="numeric" value={handle} onChange={(e) => updateHandle(e.target.value)} />
      ) : (
        <Input
          type="url"
          placeholder={preset === "google" ? "https://g.page/r/xxxxx/review" : "https://..."}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Configuramos os cartões com esse destino antes do envio — depois de receber, você recebe um link pessoal para
        trocar sozinho, sem precisar de conta.
      </p>
    </div>
  );
}
