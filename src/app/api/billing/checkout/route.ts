import { NextRequest, NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { z } from "zod";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { PLANS, stripePriceIdForPlan } from "@/lib/plans";
import { getStoreProduct, applyStoreProductOverrides } from "@/lib/store-products";
import { getSiteSettings } from "@/lib/site-settings";
import { customerDocumentSchema, customerPhoneSchema } from "@/lib/validations/store-order";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import type Stripe from "stripe";
import type { PlanType } from "@/generated/prisma/client";

// Motor de Ativação (Fase 18) — checkout único: assinatura do plano, com um
// add-on opcional de cartões físicos na MESMA sessão. Os quatro campos do
// add-on ou vêm todos juntos (o cliente pediu cartões) ou nenhum (só o
// plano) — nunca uma combinação parcial, por isso o `.refine` abaixo.
const checkoutSchema = z
  .object({
    plan: z.enum(["STARTER", "PRO", "BUSINESS"]),
    cardProductId: z.string().optional(),
    destinationUrl: z.string().url("Informe um link válido").optional(),
    customerDocument: customerDocumentSchema.optional(),
    customerPhone: customerPhoneSchema.optional(),
  })
  .refine(
    (data) => !data.cardProductId || (data.destinationUrl && data.customerDocument && data.customerPhone),
    { message: "Para adicionar cartões físicos, informe também o link de destino, CPF/CNPJ e telefone." }
  );

/**
 * Billing (Fase 15) — cria uma Stripe Checkout Session em modo assinatura
 * para o plano escolhido. Nunca muda `Company.plan` diretamente aqui: só o
 * webhook (`/api/stripe/webhook`), depois de `checkout.session.completed`
 * confirmar o pagamento de verdade, é que escreve o plano — evitar dar o
 * plano antes do pagamento ser confirmado é o ponto inteiro de usar Stripe
 * Checkout em vez de uma troca otimista no banco. Ver ADR-062.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const input = checkoutSchema.parse(await req.json());
    const { plan } = input;

    if (!stripe) {
      return NextResponse.json({ error: "Cobrança indisponível (Stripe não configurado)" }, { status: 503 });
    }
    const priceId = stripePriceIdForPlan(plan as PlanType);
    if (!priceId) {
      return NextResponse.json(
        { error: `Plano ${plan} não está configurado para cobrança (faltando price id do Stripe)` },
        { status: 503 }
      );
    }

    const company = await prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } });

    // Achado real na revisão de fluxo (11/09/2026): esta rota nunca checava
    // se a empresa JÁ tinha uma assinatura viva antes de criar outra — um
    // cliente que voltasse em /onboarding/plan (a URL continua acessível
    // depois de já ter assinado) criaria uma SEGUNDA assinatura na Stripe,
    // cobrando duas vezes por mês, silenciosamente. Trocar de plano numa
    // assinatura já ativa é sempre pelo Portal de Cobrança (que agora
    // reflete o plano certo de volta — ver webhook), nunca por um novo
    // checkout.
    if (company.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(company.stripeSubscriptionStatus ?? "")) {
      return NextResponse.json(
        { error: "Sua empresa já tem uma assinatura ativa. Para trocar de plano, use \"Gerenciar assinatura\" em Configurações." },
        { status: 409 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: priceId, quantity: 1 }];
    let cardProduct: ReturnType<typeof getStoreProduct> | undefined;
    let cardAmountTotalCents = 0;

    if (input.cardProductId) {
      const baseProduct = getStoreProduct(input.cardProductId);
      if (!baseProduct) return NextResponse.json({ error: "Produto de cartão não encontrado" }, { status: 404 });
      const settings = await getSiteSettings().catch(() => null);
      [cardProduct] = applyStoreProductOverrides([baseProduct], settings?.storeProductOverrides);
      cardAmountTotalCents = cardProduct.unitPriceCents * cardProduct.quantity;
      // Stripe permite combinar um preço recorrente com um item avulso
      // (price_data, sem `recurring`) na mesma Checkout Session em modo
      // assinatura — uma cobrança só, um StoreOrder só, ver ADR-065.
      lineItems.push({
        price_data: {
          currency: "brl",
          unit_amount: cardProduct.unitPriceCents,
          product_data: { name: `${cardProduct.name} — ${BRAND.name}`, description: cardProduct.description },
        },
        quantity: cardProduct.quantity,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: company.stripeCustomerId ?? undefined,
      customer_email: company.stripeCustomerId ? undefined : ctx.email,
      client_reference_id: company.id,
      line_items: lineItems,
      shipping_address_collection: cardProduct ? { allowed_countries: ["BR"] } : undefined,
      // Mesmo padrão do checkout da loja avulsa (/api/store/checkout) — só
      // pede endereço de cobrança quando o pedido inclui cartão físico de
      // verdade (nota fiscal futura), nunca para quem só assina o plano.
      billing_address_collection: cardProduct ? "required" : undefined,
      subscription_data: { metadata: { companyId: company.id, plan } },
      metadata: { companyId: company.id, plan },
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/onboarding/plan?billing=canceled`,
      allow_promotion_codes: true,
    });

    if (cardProduct) {
      // orderType CARD_PLUS_SAAS, companyId já conhecido (usuário autenticado
      // neste fluxo) — nunca cai no caminho de empresa convidada.
      await prisma.storeOrder.create({
        data: {
          stripeCheckoutSessionId: session.id,
          customerEmail: ctx.email,
          customerName: company.name,
          customerDocument: input.customerDocument,
          customerPhone: input.customerPhone,
          orderType: "CARD_PLUS_SAAS",
          companyId: company.id,
          productId: cardProduct.id,
          quantity: cardProduct.quantity,
          destinationUrl: input.destinationUrl!,
          amountTotalCents: cardAmountTotalCents,
        },
      });
    }

    return NextResponse.json({ url: session.url, planLabel: PLANS[plan as PlanType].name });
  } catch (error) {
    return handleApiError(error);
  }
}
