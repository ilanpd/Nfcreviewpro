import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { getStoreProduct } from "@/lib/store-products";
import { OnboardingForm } from "./onboarding-form";
import type { PlanType } from "@/generated/prisma/client";

// Fase 21 — repassa `plan`/`cardProductId` (vindos do `/sign-up`) adiante
// pro formulário, que os carrega pro próximo salto (`/onboarding/plan`).
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cardProductId?: string }>;
}) {
  const ctx = await getAuthContext();
  if (ctx) redirect("/dashboard");

  const { plan, cardProductId } = await searchParams;
  const initialPlan = plan && plan in PLANS ? (plan as PlanType) : undefined;
  const initialCardProductId = cardProductId && getStoreProduct(cardProductId) ? cardProductId : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Como se chama sua empresa?</h1>
          <p className="text-sm text-muted-foreground">Só isso por agora — o resto vem depois de escolher seu plano.</p>
        </div>
        <OnboardingForm initialPlan={initialPlan} initialCardProductId={initialCardProductId} />
      </div>
    </div>
  );
}
