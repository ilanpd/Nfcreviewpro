"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function BillingPortalButton({ hasSubscription }: { hasSubscription: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const url = hasSubscription ? "/api/billing/portal" : "/onboarding/plan";
      if (!hasSubscription) {
        window.location.href = url;
        return;
      }
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível abrir o gerenciamento de assinatura");
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={loading}>
      {loading ? "Abrindo…" : hasSubscription ? "Gerenciar assinatura" : "Escolher plano pago"}
    </Button>
  );
}
