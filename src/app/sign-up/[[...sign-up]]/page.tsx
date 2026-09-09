import { headers } from "next/headers";
import { SignUp } from "@clerk/nextjs";
import { resolveBrandByHost } from "@/lib/white-label/resolve-brand";
import { BrandedAuthScreen, clerkAppearanceFor } from "@/components/white-label/branded-auth-screen";

// White Label (Fase 10) — mesma resolução direta por Host que /sign-in;
// ver a nota lá e em middleware.ts para o porquê disso não vive em
// middleware (Edge Runtime não sustenta o Prisma).
export default async function SignUpPage() {
  const host = (await headers()).get("host");
  const brand = await resolveBrandByHost(host);

  return (
    <BrandedAuthScreen brand={brand}>
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" appearance={clerkAppearanceFor(brand)} />
    </BrandedAuthScreen>
  );
}
