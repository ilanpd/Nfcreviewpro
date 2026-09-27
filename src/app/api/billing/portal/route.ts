import { NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

/**
 * Billing (Fase 15) — Stripe Billing Portal: upgrade/downgrade/cancelamento
 * e histórico de faturas, tudo hospedado pelo próprio Stripe (nunca
 * reimplementado aqui). Só existe para uma empresa que já tem
 * `stripeCustomerId` — ou seja, que já passou por um checkout real ao menos
 * uma vez.
 */
export async function POST() {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");

    if (!stripe) {
      return NextResponse.json({ error: "Cobrança indisponível (Stripe não configurado)" }, { status: 503 });
    }

    const company = await prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } });
    if (!company.stripeCustomerId) {
      return NextResponse.json({ error: "Esta empresa ainda não tem uma assinatura ativa" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: `${appUrl}/dashboard/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
