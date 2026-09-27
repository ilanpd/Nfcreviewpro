import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";
import { getStoreProduct } from "@/lib/store-products";
import { PlanSelector } from "./plan-selector";
import type { PlanType } from "@/generated/prisma/client";

/** Fase 21 — lê `plan`/`cardProductId` (vindos da home ou da Loja, via
 * `/sign-up` → `/onboarding`) pra pré-selecionar aqui, e conta os cartões
 * que a empresa já tem (sempre >0 pra um convidado promovido via
 * `claimGuestCompany`) pra decidir se o add-on de cartão físico recomenda
 * um pacote novo ou parte de "Nenhum". */
export default async function OnboardingPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cardProductId?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/onboarding");

  const { plan, cardProductId } = await searchParams;
  const initialPlan = plan && plan in PLANS ? (plan as PlanType) : undefined;
  const initialCardProductId = cardProductId && getStoreProduct(cardProductId) ? cardProductId : undefined;

  const cardCount = await prisma.nFCCard.count({ where: { companyId: ctx.companyId } });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Escolha seu plano</h1>
          <p className="text-sm text-muted-foreground">
            Sua empresa já está criada — falta só ativar a assinatura para começar a usar o NFC OS.
          </p>
        </div>
        <PlanSelector initialPlan={initialPlan} initialCardProductId={initialCardProductId} hasExistingCards={cardCount > 0} cardCount={cardCount} />
      </div>
    </div>
  );
}
