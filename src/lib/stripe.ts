import "server-only";
import Stripe from "stripe";

/**
 * Billing (Fase 15) — cliente único do Stripe, mesmo padrão de singleton de
 * `lib/prisma.ts`. Ao contrário do Redis/Queue Engine, billing não tem um
 * modo de degradação graciosa: sem `STRIPE_SECRET_KEY` configurada, toda
 * rota que precisa cobrar lança um erro explícito na hora — cobrar dinheiro
 * "às vezes" seria pior do que a feature simplesmente não existir. Ver
 * ADR-062.
 */
declare global {
  var stripeGlobal: Stripe | undefined;
}

function createStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export const stripe = globalThis.stripeGlobal ?? createStripeClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.stripeGlobal = stripe ?? undefined;
}

export function requireStripe(): Stripe {
  if (!stripe) throw new Error("STRIPE_SECRET_KEY não configurada — billing indisponível");
  return stripe;
}
