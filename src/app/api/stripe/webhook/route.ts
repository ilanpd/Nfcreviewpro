import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/observability/logger";
import { provisionStoreOrder } from "@/services/store-order.service";
import { getCompanyOwnerEmail } from "@/services/company.service";
import { planForStripePriceId, PLANS } from "@/lib/plans";
import { publishEvent } from "@/lib/event-bus/publish";
import { sendEmail } from "@/lib/email";
import { subscriptionWelcomeEmailHtml, billingPastDueEmailHtml, subscriptionCanceledEmailHtml } from "@/lib/email-templates/billing";
import { appBaseUrl } from "@/lib/app-url";
import { BRAND } from "@/lib/brand";
import { Prisma, type PlanType } from "@/generated/prisma/client";

export const runtime = "nodejs";

/**
 * Billing (Fase 15) — único ponto que escreve `Company.plan`/
 * `stripeSubscriptionStatus` depois do checkout inicial. Verifica a
 * assinatura HMAC do Stripe (`STRIPE_WEBHOOK_SECRET`) antes de confiar em
 * qualquer payload — sem isso, qualquer um poderia enviar um POST fingindo
 * "pagamento confirmado" para esta rota. `req.text()` (não `req.json()`) é
 * obrigatório aqui: a verificação de assinatura precisa dos bytes exatos do
 * corpo, antes de qualquer parsing.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe não configurado" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    log.error("stripe-webhook", "Assinatura inválida", { error: String(err) });
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Motor de Ativação (Fase 18) — StoreOrder e Company deixam de ser
        // ramos mutuamente exclusivos por `session.mode`. Toda sessão
        // (loja avulsa OU o add-on de cartões dentro do checkout combinado)
        // pode ter um StoreOrder esperando por ela; toda sessão em modo
        // assinatura pode ter uma Company esperando o plano. As duas coisas
        // rodam sempre que existirem, nunca uma excluindo a outra.
        const updatedOrder = await prisma.storeOrder
          .update({
            where: { stripeCheckoutSessionId: session.id },
            data: {
              status: "PAID",
              stripePaymentIntentId:
                typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? undefined),
              shippingAddress: session.collected_information?.shipping_details
                ? (session.collected_information.shipping_details as unknown as object)
                : undefined,
              billingAddress: session.customer_details?.address
                ? (session.customer_details.address as unknown as object)
                : undefined,
            },
          })
          .catch((err) => {
            // P2025 = nenhum StoreOrder com este session id — o caso normal
            // de uma assinatura sem add-on de cartões, nunca um erro real.
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return null;
            log.error("stripe-webhook", "Falha ao marcar StoreOrder como pago", { error: String(err), sessionId: session.id });
            return null;
          });

        if (updatedOrder) {
          // Fase 18: assim que o pagamento é confirmado, o provisionamento
          // roda sozinho (cria os NFCCard reais, e uma Company GUEST se
          // nenhuma conta existir para o e-mail do comprador — nunca o
          // caso aqui, já que um pedido combinado sempre já tem companyId).
          // O clique manual no Admin vira só o fallback para quando isto falhar.
          await provisionStoreOrder(updatedOrder.id).catch((err) => {
            log.error("stripe-webhook", "Falha ao provisionar StoreOrder automaticamente — use o botão manual no Admin", {
              error: String(err),
              orderId: updatedOrder.id,
            });
          });
        }

        if (session.mode === "subscription") {
          const companyId = session.metadata?.companyId ?? session.client_reference_id;
          const plan = session.metadata?.plan as PlanType | undefined;
          if (!companyId || !plan) {
            log.error("stripe-webhook", "checkout.session.completed sem companyId/plan nos metadados", { sessionId: session.id });
            break;
          }
          const companyBeforeCheckout = await prisma.company.findUnique({
            where: { id: companyId },
            select: { plan: true, name: true, subscriptionWelcomeEmailSentAt: true },
          });
          await prisma.company.update({
            where: { id: companyId },
            data: {
              plan,
              stripeCustomerId: typeof session.customer === "string" ? session.customer : (session.customer?.id ?? undefined),
              stripeSubscriptionId:
                typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? undefined),
              stripeSubscriptionStatus: "active",
              // Marca quando o estado da assinatura mudou: é o relógio da
              // tolerância e do período de leitura (domain/billing, ADR-079).
              subscriptionStatusChangedAt: new Date(),
            },
          });
          if (companyBeforeCheckout && companyBeforeCheckout.plan !== plan) {
            await publishEvent(
              "PlanoAlterado",
              { companyId, previousPlan: companyBeforeCheckout.plan, newPlan: plan, reason: "CHECKOUT_INICIAL" },
              { companyId }
            );
          }
          // E-mail "boas-vindas ao assinar" (C9/F6) — só na primeira vez que
          // esta empresa assina (nunca de novo numa troca de plano ou num
          // segundo checkout depois de reativar). `after()`: nunca atrasa a
          // resposta 200 que o Stripe espera rápido.
          if (companyBeforeCheckout && !companyBeforeCheckout.subscriptionWelcomeEmailSentAt) {
            after(() => {
              sendSubscriptionWelcomeEmail(companyId, companyBeforeCheckout.name, plan).catch((err) =>
                log.error("stripe-webhook", "Falha ao enviar e-mail de boas-vindas", { error: String(err), companyId })
              );
            });
          }
          log.info("stripe-webhook", `Empresa ${companyId} confirmada no plano ${plan}`, { companyId, plan });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const companyId = subscription.metadata?.companyId;
        if (!companyId) break;

        const companyBeforeUpdate = await prisma.company.findUnique({
          where: { id: companyId },
          select: {
            plan: true,
            name: true,
            stripeSubscriptionStatus: true,
            billingPastDueEmailSentAt: true,
            subscriptionCanceledEmailSentAt: true,
          },
        });
        if (!companyBeforeUpdate) break;

        const data: {
          stripeSubscriptionStatus: string;
          subscriptionStatusChangedAt?: Date;
          plan?: PlanType;
          billingPastDueEmailSentAt?: Date | null;
        } = {
          stripeSubscriptionStatus: subscription.status,
        };
        const statusChanged = subscription.status !== companyBeforeUpdate.stripeSubscriptionStatus;
        // Só quando o status de fato mudou: uma troca de plano com a assinatura
        // continuando "active" não pode reiniciar o relógio de uma cobrança atrasada.
        if (statusChanged) {
          data.subscriptionStatusChangedAt = new Date();
        }
        // Downgrade automático para Starter quando a assinatura é cancelada
        // ou fica definitivamente inadimplente — nunca deixa a empresa presa
        // num plano pago sem cobrança ativa por trás.
        if (subscription.status === "canceled" || subscription.status === "unpaid") {
          data.plan = "STARTER";
        } else {
          // Achado real na revisão de fluxo (11/09/2026): uma troca de plano
          // feita pelo próprio cliente no Portal de Cobrança da Stripe (não
          // pelo nosso checkout) nunca passa por `checkout.session.completed`
          // de novo — só dispara este evento, com `status` continuando
          // "active" o tempo todo. Sem isto, o cliente pagava o valor novo e
          // ficava preso nos limites do plano antigo. Sempre reflete o Price
          // real da assinatura, não só o que foi escolhido uma vez no início.
          const priceId = subscription.items.data[0]?.price?.id;
          const newPlan = priceId ? planForStripePriceId(priceId) : null;
          if (newPlan) data.plan = newPlan;
        }
        // Recuperou de um atraso (voltou a "active"/"trialing"): destrava o
        // aviso de cobrança atrasada para um atraso FUTURO poder avisar de
        // novo — sem isto, o segundo atraso nunca seria notificado.
        if (statusChanged && (subscription.status === "active" || subscription.status === "trialing")) {
          data.billingPastDueEmailSentAt = null;
        }
        await prisma.company.update({ where: { id: companyId }, data }).catch(() => {
          // Empresa pode já ter sido removida — não é um erro de webhook.
        });

        // E-mails de cobrança (C9/F6) — só na transição de verdade, nunca a
        // cada entrega/retry do mesmo evento do Stripe com o status igual ao
        // que já estava gravado. `after()`: nunca atrasa a resposta 200.
        if (statusChanged && subscription.status === "past_due" && !companyBeforeUpdate.billingPastDueEmailSentAt) {
          after(() => {
            sendBillingPastDueEmail(companyId, companyBeforeUpdate.name).catch((err) =>
              log.error("stripe-webhook", "Falha ao enviar e-mail de cobrança atrasada", { error: String(err), companyId })
            );
          });
        }
        if (
          statusChanged &&
          (subscription.status === "canceled" || subscription.status === "unpaid") &&
          !companyBeforeUpdate.subscriptionCanceledEmailSentAt
        ) {
          after(() => {
            sendSubscriptionCanceledEmail(companyId, companyBeforeUpdate.name).catch((err) =>
              log.error("stripe-webhook", "Falha ao enviar e-mail de cancelamento", { error: String(err), companyId })
            );
          });
        }

        if (data.plan && data.plan !== companyBeforeUpdate.plan) {
          await publishEvent(
            "PlanoAlterado",
            {
              companyId,
              previousPlan: companyBeforeUpdate.plan,
              newPlan: data.plan,
              reason: subscription.status === "canceled" || subscription.status === "unpaid" ? "CANCELAMENTO" : "TROCA_PORTAL_STRIPE",
            },
            { companyId }
          );
        }
        break;
      }

      // Segurança/observabilidade (Auditoria Nível Bilionário, 11/09/2026) —
      // antes destes dois `case`s, uma falha de cobrança recorrente ou uma
      // contestação de pagamento eram completamente invisíveis: nenhum log,
      // nenhum alerta, nada. `customer.subscription.updated` já reage
      // DEPOIS que a Stripe desiste de tentar (`past_due`→`unpaid`) — isto
      // aqui captura o primeiro sinal, antes disso. Não muda `plan`/status
      // (isso continua sendo só responsabilidade do handler de assinatura
      // acima, para nunca ter dois lugares escrevendo o mesmo campo) — só
      // torna o evento visível em log/Sentry, já que este produto ainda não
      // tem e-mail/WhatsApp real para avisar o cliente diretamente.
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const companyId =
          typeof invoice.parent?.subscription_details?.metadata?.companyId === "string"
            ? invoice.parent.subscription_details.metadata.companyId
            : undefined;
        log.error("stripe-webhook", "Falha de cobrança numa assinatura — cliente em risco de downgrade automático", {
          companyId,
          invoiceId: invoice.id,
          amountDue: invoice.amount_due,
          attemptCount: invoice.attempt_count,
        });
        break;
      }

      // Auditoria do Fluxo de Vendas (12/09/2026) — antes, uma disputa só
      // virava log; o Admin nunca sabia que existia dinheiro em risco sem
      // alguém checando o Stripe Dashboard por conta própria. Agora, quando
      // o `payment_intent` da disputa bate com o de um StoreOrder, isso vira
      // um alerta visível no Centro de Operações (ver disputedAt/
      // disputeStatus no schema e o banner em orders-board.tsx). Continua
      // logando sempre — nem toda disputa é de um StoreOrder (pode ser de
      // uma assinatura), e o log cobre esse caso também.
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId =
          typeof dispute.payment_intent === "string" ? dispute.payment_intent : (dispute.payment_intent?.id ?? null);

        log.error("stripe-webhook", `Disputa de cobrança (${event.type}) — requer atenção`, {
          disputeId: dispute.id,
          chargeId: typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id,
          amount: dispute.amount,
          reason: dispute.reason,
          status: dispute.status,
        });

        if (paymentIntentId) {
          // `disputedAt` marca só a ABERTURA (grava uma vez, em `.created`);
          // `.updated`/`.closed` só atualizam o status, para nunca perder a
          // data original da disputa por causa de um evento posterior.
          await prisma.storeOrder
            .updateMany({
              where: { stripePaymentIntentId: paymentIntentId },
              data:
                event.type === "charge.dispute.created"
                  ? { disputedAt: new Date(), disputeStatus: dispute.status }
                  : { disputeStatus: dispute.status },
            })
            .catch((err) => {
              log.error("stripe-webhook", "Falha ao vincular disputa a um StoreOrder", { error: String(err), disputeId: dispute.id });
            });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    log.error("stripe-webhook", `Falha ao processar evento ${event.type}`, { error: String(err) });
    return NextResponse.json({ error: "Falha ao processar evento" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// --- e-mails transacionais de assinatura (C9/F6) -----------------------------
// Cada uma repete o mesmo padrão idempotente de `services/store-order.service.ts`
// (`sendOrderEmail`): só marca o timestamp depois de um envio confirmado
// (`sent: true`), nunca antes — uma falha de envio pode tentar de novo no
// próximo evento, um envio bem-sucedido nunca duplica.

async function sendSubscriptionWelcomeEmail(companyId: string, companyName: string, plan: PlanType) {
  const ownerEmail = await getCompanyOwnerEmail(companyId);
  if (!ownerEmail) return;
  const { sent } = await sendEmail({
    to: ownerEmail,
    subject: `Bem-vindo(a) ao ${BRAND.name} — assinatura confirmada`,
    html: subscriptionWelcomeEmailHtml({ companyName, planLabel: PLANS[plan].name, dashboardUrl: `${appBaseUrl()}/dashboard` }),
  });
  if (sent) {
    await prisma.company.update({ where: { id: companyId }, data: { subscriptionWelcomeEmailSentAt: new Date() } });
  }
}

async function sendBillingPastDueEmail(companyId: string, companyName: string) {
  const ownerEmail = await getCompanyOwnerEmail(companyId);
  if (!ownerEmail) return;
  const { sent } = await sendEmail({
    to: ownerEmail,
    subject: `Não conseguimos confirmar sua cobrança — ${BRAND.name}`,
    html: billingPastDueEmailHtml({ companyName, settingsUrl: `${appBaseUrl()}/dashboard/settings` }),
  });
  if (sent) {
    await prisma.company.update({ where: { id: companyId }, data: { billingPastDueEmailSentAt: new Date() } });
  }
}

async function sendSubscriptionCanceledEmail(companyId: string, companyName: string) {
  const ownerEmail = await getCompanyOwnerEmail(companyId);
  if (!ownerEmail) return;
  const { sent } = await sendEmail({
    to: ownerEmail,
    subject: `Sua assinatura foi cancelada — ${BRAND.name}`,
    html: subscriptionCanceledEmailHtml({ companyName, dashboardUrl: `${appBaseUrl()}/dashboard/settings` }),
  });
  if (sent) {
    await prisma.company.update({ where: { id: companyId }, data: { subscriptionCanceledEmailSentAt: new Date() } });
  }
}
