"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnalyticsCard } from "@nfc-os/ui";

/**
 * PIN da loja (ADR-081). O valor nunca é lido de volta — só se existe
 * (`hasPin`, vindo do servidor). Trocar exige digitar de novo, sempre; não
 * existe "mostrar o PIN atual".
 */
export function PinForm({ hasPin, offerExists, canManage }: { hasPin: boolean; offerExists: boolean; canManage: boolean }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/return/offer/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fieldError = data.issues?.fieldErrors?.pin?.[0];
        throw new Error(fieldError ?? data.error ?? "Não foi possível salvar o PIN");
      }
      toast.success(hasPin ? "PIN trocado" : "PIN definido — o Retorno já pode ser ativado");
      setPin("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) return null;

  if (!offerExists) {
    return (
      <AnalyticsCard title="PIN da loja" description="Só a equipe conhece. O atendente digita na tela do cliente para confirmar cada resgate.">
        <p className="text-sm text-muted-foreground">Escreva e salve o brinde ao lado primeiro — o PIN pertence a ele.</p>
      </AnalyticsCard>
    );
  }

  return (
    <AnalyticsCard
      title="PIN da loja"
      description="Só a equipe conhece. O atendente digita na tela do cliente para confirmar cada resgate."
    >
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label htmlFor="pin" className="flex items-center gap-1.5">
            <KeyRound className="size-3.5" />
            {hasPin ? "Novo PIN (4 dígitos)" : "Defina o PIN (4 dígitos)"}
          </Label>
          <Input
            id="pin"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            required
          />
        </div>
        <Button type="submit" disabled={saving || pin.length !== 4}>
          {saving ? "Salvando…" : hasPin ? "Trocar" : "Definir"}
        </Button>
      </form>
    </AnalyticsCard>
  );
}
