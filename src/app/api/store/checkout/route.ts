import { NextRequest, NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { getStoreProduct, applyStoreProductOverrides } from "@/lib/store-products";
import { getSiteSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { getAuthContext } from "@/lib/auth";
import { customerDocumentSchema, customerPhoneSchema } from "@/lib/validations/store-order";
import { httpUrlSchema } from "@/lib/validations/http-url";
import { cardLimitForPlan } from "@/lib/plans";

const storeCheckoutSchema = z.object({
  productId: z.string(),
  destinationUrl: httpUrlSchema(),
  customerName: z.string().trim().min(2, "Nome muito curto").max(120),
  customerEmail: z.string().email("E-mail inválido"),
  customerDocument: customerDocumentSchema,
  customerPhone: customerPhoneSchema,
});

/**
 * Loja pública (Fase 15) — checkout de pagamento único (nunca assinatura,
 * diferente de /api/billing/checkout). Pública de propósito: não exige
 * `requireAuthContext()` — um comprador da loja pode nunca ter (ou nunca
 * vir a ter) uma conta no SaaS. `destinationUrl` e os dados do comprador vão
 * direto para o `StoreOrder` (PENDING_PAYMENT) antes do redirect ao Stripe,
 * para nunca depender só dos metadados da sessão se o webhook demorar.
 */
export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Loja indisponível (Stripe não configurado)" }, { status: 503 });
    }

    const input = storeCheckoutSchema.parse(await req.json());
    const baseProduct = getStoreProduct(input.productId);
    if (!baseProduct) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }
    // Cobra o mesmo preço que a vitrine mostrou — nunca o catálogo estático
    // direto quando o Painel Admin já sobrescreveu o valor (ver ADR-059).
    const settings = await getSiteSettings().catch(() => null);
    const [product] = applyStoreProductOverrides([baseProduct], settings?.storeProductOverrides);

    // Associação silenciosa: se o comprador já tem uma sessão ativa no SaaS,
    // o pedido fica ligado à empresa dele para aparecer no histórico depois
    // — nunca uma pergunta "você tem conta?" no checkout, o mesmo padrão dos
    // grandes e-commerces (conta é opcional, nunca bloqueia a compra).
    const ctx = await getAuthContext().catch(() => null);

    // C15 — achado real de auditoria: um assinante já logado (CUSTOMER, não
    // GUEST) conseguia comprar aqui mais cartões do que o próprio plano
    // permite usar (ex.: Starter, `cardLimit: 1`, comprando um `pack-20`) —
    // `createCard` (fluxo do dashboard) sempre checou isso, esta rota nunca
    // checou. Só se aplica a CUSTOMER: um convidado (`GUEST`, sem
    // assinatura) sempre pôde comprar em lote livremente, de propósito
    // (`services/card.service.ts`, comentário de `createCard`) — nunca
    // bloquear isso.
    if (ctx) {
      const company = await prisma.company.findUnique({ where: { id: ctx.companyId }, select: { plan: true, accountType: true } });
      if (company?.accountType === "CUSTOMER") {
        const limit = cardLimitForPlan(company.plan);
        if (limit !== null) {
          const currentCount = await prisma.nFCCard.count({ where: { companyId: ctx.companyId } });
          if (currentCount + baseProduct.quantity > limit) {
            return NextResponse.json(
              {
                error:
                  limit === 1
                    ? `Seu plano permite ${limit} cartão. Você já tem ${currentCount}. Para adicionar mais, faça upgrade.`
                    : `Seu plano permite até ${limit} cartões. Você já tem ${currentCount} e essa compra passaria do limite. Para adicionar mais, faça upgrade.`,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const amountTotalCents = product.unitPriceCents * product.quantity;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.customerEmail,
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: product.unitPriceCents,
            product_data: { name: `${product.name} — ${BRAND.name}`, description: product.description },
          },
          quantity: product.quantity,
        },
      ],
      shipping_address_collection: { allowed_countries: ["BR"] },
      // Reaproveita a própria UI de cobrança do Stripe em vez de um formulário
      // de endereço próprio — o mesmo padrão já usado para `shippingAddress`
      // (capturado do Checkout, nunca digitado duas vezes pelo comprador).
      billing_address_collection: "required",
      metadata: { productId: product.id, destinationUrl: input.destinationUrl, customerName: input.customerName },
      success_url: `${appUrl}/loja/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/loja`,
    });

    await prisma.storeOrder.create({
      data: {
        stripeCheckoutSessionId: session.id,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        customerDocument: input.customerDocument,
        customerPhone: input.customerPhone,
        orderType: "CARD_ONLY",
        companyId: ctx?.companyId,
        productId: product.id,
        quantity: product.quantity,
        destinationUrl: input.destinationUrl,
        amountTotalCents,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
