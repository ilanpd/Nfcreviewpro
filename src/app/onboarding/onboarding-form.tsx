"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumCardShell } from "@nfc-os/ui";
import type { PlanType } from "@/generated/prisma/client";

/**
 * C15 — reduzido ao mínimo essencial (só o nome). O pedido original é
 * explícito: "primeiro comprei, agora vamos ativar seu negócio", não
 * configurar WhatsApp/Google/cor antes mesmo de escolher o plano — isso
 * migrou pra `/onboarding/ativar`, depois do pagamento confirmado.
 * `initialPlan`/`initialCardProductId` continuam só repassados adiante
 * (Fase 21) — esta tela nunca decide nada sobre eles.
 */
export function OnboardingForm({
  initialPlan,
  initialCardProductId,
  hasCard,
}: {
  initialPlan?: PlanType;
  initialCardProductId?: string;
  hasCard?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível concluir o cadastro");
      }
      const data = await res.json();
      toast.success(
        data.claimedExistingCards
          ? "Empresa criada — encontramos cartão(ões) já comprados com este e-mail e vinculamos à sua conta automaticamente."
          : "Empresa criada com sucesso!"
      );
      const nextParams = new URLSearchParams();
      if (initialPlan) nextParams.set("plan", initialPlan);
      if (initialCardProductId) nextParams.set("cardProductId", initialCardProductId);
      if (hasCard) nextParams.set("hasCard", "1");
      const query = nextParams.toString();
      router.push(query ? `/onboarding/plan?${query}` : "/onboarding/plan");
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
            <Label htmlFor="name">Nome da empresa</Label>
            <Input
              id="name"
              placeholder="Ex: Restaurante Sabor & Arte"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Só isso por enquanto — WhatsApp, link do Google e cor da marca a gente pede depois de confirmar o pagamento.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando…" : "Continuar"}
          </Button>
        </form>
      </div>
    </PremiumCardShell>
  );
}
