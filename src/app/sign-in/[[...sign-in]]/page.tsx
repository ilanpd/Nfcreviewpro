import { headers } from "next/headers";
import { SignIn } from "@clerk/nextjs";
import { resolveBrandByHost } from "@/lib/white-label/resolve-brand";
import { BrandedAuthScreen, clerkAppearanceFor } from "@/components/white-label/branded-auth-screen";

// White Label (Fase 10) — resolve a marca aqui, direto pelo Host desta
// própria requisição (Server Component, runtime Node) — não no middleware,
// que roda em Edge e não sustenta o Prisma que o resolver precisa. Ver
// ADR-042 e a nota em middleware.ts.
export default async function SignInPage() {
  const host = (await headers()).get("host");
  const brand = await resolveBrandByHost(host);

  return (
    <BrandedAuthScreen brand={brand}>
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" appearance={clerkAppearanceFor(brand)} />
    </BrandedAuthScreen>
  );
}
