"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumCardShell } from "@nfc-os/ui";
import { cn } from "@/lib/utils";

const PRESET_COLORS = ["#0F172A", "#1D4ED8", "#059669", "#B91C1C", "#7C3AED", "#EA580C"];

/**
 * C15 — os três campos que `/onboarding` deixou de pedir antes do
 * pagamento. `POST /api/company/activate` (não `/api/onboarding`, que já
 * rodou, nem `PATCH /api/company`, que é Configurações) carimba
 * `Company.activatedAt` na primeira vez.
 */
export function ActivationForm({
  initialWhatsapp,
  initialGoogleReviewUrl,
  initialPrimaryColor,
}: {
  initialWhatsapp: string;
  initialGoogleReviewUrl: string;
  initialPrimaryColor: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    whatsapp: initialWhatsapp,
    googleReviewUrl: initialGoogleReviewUrl,
    primaryColor: PRESET_COLORS.includes(initialPrimaryColor) ? initialPrimaryColor : PRESET_COLORS[0],
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/company/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível ativar sua empresa");
      }
      toast.success("Tudo pronto — seu Pulse está ativo!");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PremiumCardShell className="shadow-premium">
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp do gerente</Label>
            <Input
              id="whatsapp"
              placeholder="Ex: 5511999999999"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              required
              minLength={10}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              As mensagens que os clientes enviarem em &quot;Falar com a gente&quot; chegam por aqui. Use DDI e DDD, apenas números.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleReviewUrl">Link de avaliação do Google</Label>
            <Input
              id="googleReviewUrl"
              type="url"
              placeholder="https://g.page/r/xxxxx/review"
              value={form.googleReviewUrl}
              onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label id="primary-color-label">Cor principal da marca</Label>
            {/* Achado de auditoria (28/09/2026): o anel de seleção usava a
                MESMA cor do próprio botão — visualmente quase imperceptível
                (a "seleção" só deixava o círculo 2px maior) — e não tinha
                `aria-pressed`, então um leitor de tela não anunciava qual
                cor estava escolhida. Agora o anel contrasta com o fundo e
                a cor escolhida ganha um ✓ visível nos dois temas. */}
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="primary-color-label">
              {PRESET_COLORS.map((color) => {
                const isSelected = form.primaryColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Cor ${color}`}
                    aria-pressed={isSelected}
                    onClick={() => setForm({ ...form, primaryColor: color })}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
                      isSelected && "ring-2 ring-foreground"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {isSelected ? <Check className="size-4 text-white drop-shadow-sm" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ativando…" : "Ativar meu negócio"}
          </Button>
        </form>
      </div>
    </PremiumCardShell>
  );
}
