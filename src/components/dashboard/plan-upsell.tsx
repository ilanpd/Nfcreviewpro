import Link from "next/link";
import { EmptyState } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import type { PlanType } from "@/generated/prisma/client";

/**
 * Fase 20 — Entitlements por plano. Mesmo bloco de upsell que já existia
 * (duplicado à mão) em `dashboard/unidades/page.tsx` desde a Fase 18, agora
 * reaproveitado por toda página gated por `planHasFeature()`
 * (`lib/plans.ts`) — nunca esconde o item do menu, sempre mostra o que
 * falta e o caminho pra resolver (upgrade em Configurações), nunca um erro
 * genérico.
 */
export function PlanUpsell({
  icon,
  featureLabel,
  requiredPlan,
  currentPlan,
}: {
  icon: React.ReactNode;
  featureLabel: string;
  requiredPlan: PlanType;
  currentPlan: PlanType;
}) {
  return (
    <div className="space-y-4">
      <EmptyState
        icon={icon}
        title={`Recurso do plano ${PLANS[requiredPlan].name}`}
        description={`${featureLabel} faz parte do plano ${PLANS[requiredPlan].name} (${PLANS[requiredPlan].priceLabel}). Seu plano atual é ${PLANS[currentPlan].name}.`}
      />
      <div className="flex justify-center">
        <Button asChild>
          <Link href="/dashboard/settings">Ver planos em Configurações</Link>
        </Button>
      </div>
    </div>
  );
}
