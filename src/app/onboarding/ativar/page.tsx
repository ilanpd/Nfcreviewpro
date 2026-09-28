import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivationForm } from "./activation-form";

/**
 * "Primeiro comprei. Agora vamos ativar seu negócio." (C15) — destino de
 * `success_url` do checkout de assinatura (`/api/billing/checkout`), depois
 * do pagamento confirmado. Pede o que o onboarding reduzido (`/onboarding`)
 * deixou de pedir antes de pagar: WhatsApp, link do Google, cor da marca.
 * Nunca aparece de novo depois de ativado (`activatedAt` preenchido) — quem
 * revisitar o link cai direto no painel.
 */
export default async function ActivatePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/onboarding");

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: ctx.companyId },
    select: { name: true, whatsapp: true, googleReviewUrl: true, primaryColor: true, activatedAt: true },
  });
  if (company.activatedAt) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-brand-ink">Pagamento confirmado</p>
          <h1 className="text-2xl font-semibold tracking-tight">Agora vamos ativar o {company.name}</h1>
          <p className="text-sm text-muted-foreground">
            Essas informações aparecem na página que seus clientes veem ao aproximar o cartão NFC.
          </p>
        </div>
        <ActivationForm
          initialWhatsapp={company.whatsapp ?? ""}
          initialGoogleReviewUrl={company.googleReviewUrl ?? ""}
          initialPrimaryColor={company.primaryColor}
        />
      </div>
    </div>
  );
}
