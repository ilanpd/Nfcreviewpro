import Link from "next/link";
import { headers } from "next/headers";
import { SignUp } from "@clerk/nextjs";
import { resolveBrandByHost } from "@/lib/white-label/resolve-brand";
import { BrandedAuthScreen, clerkAppearanceFor } from "@/components/white-label/branded-auth-screen";
import { PLANS } from "@/lib/plans";
import { getStoreProduct } from "@/lib/store-products";
import type { PlanType } from "@/generated/prisma/client";

// White Label (Fase 10) — mesma resolução direta por Host que /sign-in;
// ver a nota lá e em middleware.ts para o porquê disso não vive em
// middleware (Edge Runtime não sustenta o Prisma).
//
// Fase 21 — carrega a intenção de plano/cartão (vinda da home ou da Loja,
// via `?plan=`/`?cardProductId=`) através do cadastro. `fallbackRedirectUrl`
// dinâmico em vez do `"/onboarding"` fixo — só isso muda de sessão pra
// sessão; nunca localStorage, pra nunca se perder num refresh. Ambos os
// parâmetros são validados contra as fontes de verdade (`PLANS`/
// `STORE_PRODUCTS`) antes de entrarem na URL — nunca repassa lixo adiante.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cardProductId?: string }>;
}) {
  const host = (await headers()).get("host");
  const brand = await resolveBrandByHost(host);
  const { plan, cardProductId } = await searchParams;

  const validPlan = plan && plan in PLANS ? (plan as PlanType) : null;
  const validCardProductId = cardProductId && getStoreProduct(cardProductId) ? cardProductId : null;

  const onboardingParams = new URLSearchParams();
  if (validPlan) onboardingParams.set("plan", validPlan);
  if (validCardProductId) onboardingParams.set("cardProductId", validCardProductId);
  const query = onboardingParams.toString();
  const fallbackRedirectUrl = query ? `/onboarding?${query}` : "/onboarding";

  return (
    <BrandedAuthScreen brand={brand}>
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl={fallbackRedirectUrl} appearance={clerkAppearanceFor(brand)} />
      <p className="mt-4 max-w-sm text-center text-xs text-muted-foreground">
        Ao criar sua conta, você concorda com os{" "}
        <Link href="/termos" className="underline">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </BrandedAuthScreen>
  );
}
