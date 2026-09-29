"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumCardShell } from "@nfc-os/ui";
import { UpgradePitchCard } from "@/components/upgrade-pitch";
import { DestinationPicker } from "@/components/destination-picker";

export function MeuCartaoForm({
  editToken,
  cardName,
  initialDestinationUrl,
  visitsThisMonth,
}: {
  editToken: string;
  cardName: string;
  initialDestinationUrl: string;
  visitsThisMonth: number;
}) {
  const [destinationUrl, setDestinationUrl] = useState(initialDestinationUrl);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // `DestinationPicker` não tem um `<input required>` nativo (mesmo padrão
    // já usado no checkout, plan-selector.tsx/store-product-grid.tsx): a
    // checagem é explícita aqui, não deixada pro navegador.
    if (!destinationUrl) {
      toast.error("Escolha ou preencha para onde o cartão deve redirecionar.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/meu-cartao/${editToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar");
      toast.success("Destino atualizado — o próximo toque já leva para o novo link");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{cardName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Controle para onde este cartão leva, sem precisar de conta.</p>
      </div>

      <PremiumCardShell className="shadow-premium">
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MousePointerClick className="size-4" aria-hidden="true" />
            {visitsThisMonth} toque(s) este mês
          </div>
          <DestinationPicker
            value={destinationUrl}
            onChange={setDestinationUrl}
            label="Para onde este cartão redireciona"
            helperText="Vale a partir do próximo toque — sem precisar reimprimir nem regravar o cartão."
          />
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Salvando…" : "Salvar novo destino"}
          </Button>
        </form>
      </PremiumCardShell>

      <p className="text-center text-xs text-muted-foreground">
        Perdeu este link?{" "}
        <Link href="/meu-cartao/recuperar" className="font-medium text-brand-ink underline underline-offset-4">
          Recuperar por e-mail
        </Link>
      </p>

      {/* Fase 21 — vai pro /sign-up, não direto pro /onboarding/plan: quem
          está aqui não tem sessão nenhuma (portal sem login), então
          /onboarding/plan só bateria de volta pro /onboarding vazio. O
          cadastro com o mesmo e-mail do pedido já promove esta empresa GUEST
          pra CUSTOMER sozinho (claimGuestCompany), sem duplicar nada. */}
      <UpgradePitchCard href="/sign-up?plan=STARTER&hasCard=1" />
    </div>
  );
}
