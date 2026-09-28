import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Webhook do Stripe (C15) — o único ponto que escreve `Company.plan`/status.
 * Stripe, Prisma, e-mail e barramento de eventos são mocks; o que está sob
 * teste é a regra da rota: o checkout combinado (assinatura + cartão)
 * liquida o pedido E ativa o plano; a reativação não reenvia boas-vindas; e um
 * evento terminal de uma assinatura ANTIGA nunca derruba a atual.
 */
const mocks = vi.hoisted(() => {
  // `lib/plans.ts` lê os Price ids no carregamento do módulo — precisa estar
  // no ambiente antes do import da rota (`vi.hoisted` roda antes dos imports).
  process.env.STRIPE_PRICE_STARTER = "price_starter_test";
  return {
    constructEvent: vi.fn(),
    orderUpdate: vi.fn(),
    orderUpdateMany: vi.fn(),
    companyFind: vi.fn(),
    companyUpdate: vi.fn(),
    provision: vi.fn(),
    publishEvent: vi.fn(),
    after: vi.fn(),
    logInfo: vi.fn(),
    logError: vi.fn(),
  };
});

// Módulos de e-mail/marca importam `server-only`, que estoura fora do Next.
vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: mocks.after }));
vi.mock("@/lib/stripe", () => ({ stripe: { webhooks: { constructEvent: mocks.constructEvent } } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    storeOrder: { update: mocks.orderUpdate, updateMany: mocks.orderUpdateMany },
    company: { findUnique: mocks.companyFind, update: mocks.companyUpdate },
  },
}));
vi.mock("@/lib/observability/logger", () => ({ log: { info: mocks.logInfo, error: mocks.logError, warn: vi.fn() } }));
vi.mock("@/services/store-order.service", () => ({ provisionStoreOrder: mocks.provision }));
vi.mock("@/services/company.service", () => ({ getCompanyOwnerEmail: vi.fn().mockResolvedValue("dono@example.com") }));
vi.mock("@/lib/event-bus/publish", () => ({ publishEvent: mocks.publishEvent }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));

import { Prisma } from "@/generated/prisma/client";
import { POST } from "./route";

function deliver(event: unknown, headers: Record<string, string> = { "stripe-signature": "t=1,v1=sig" }) {
  mocks.constructEvent.mockReturnValue(event);
  return POST(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", headers, body: "{}" }));
}

const checkoutCompleted = (overrides: Record<string, unknown> = {}) => ({
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_1",
      mode: "subscription",
      payment_intent: null,
      customer: "cus_1",
      subscription: "sub_new",
      customer_details: null,
      collected_information: null,
      metadata: { companyId: "co_1", plan: "STARTER" },
      client_reference_id: "co_1",
      ...overrides,
    },
  },
});

const subscriptionEvent = (type: string, overrides: Record<string, unknown> = {}) => ({
  type,
  data: {
    object: {
      id: "sub_new",
      status: "active",
      metadata: { companyId: "co_1" },
      items: { data: [{ price: { id: "price_starter_test" } }] },
      ...overrides,
    },
  },
});

const company = (overrides: Record<string, unknown> = {}) => ({
  plan: "STARTER",
  name: "Bella Vista",
  stripeSubscriptionId: "sub_new",
  stripeSubscriptionStatus: "active",
  billingPastDueEmailSentAt: null,
  subscriptionCanceledEmailSentAt: null,
  subscriptionWelcomeEmailSentAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  mocks.orderUpdate.mockResolvedValue({ id: "order_1" });
  mocks.provision.mockResolvedValue(undefined);
  mocks.companyFind.mockResolvedValue(company());
  mocks.companyUpdate.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/stripe/webhook — porta de entrada", () => {
  it("sem segredo configurado: 503", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await deliver(checkoutCompleted())).status).toBe(503);
  });

  it("sem cabeçalho de assinatura: 400, nada é processado", async () => {
    expect((await deliver(checkoutCompleted(), {})).status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("assinatura inválida: 400, nada é gravado", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await POST(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "x" }, body: "{}" }));
    expect(res.status).toBe(400);
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
    expect(mocks.companyUpdate).not.toHaveBeenCalled();
  });
});

describe("checkout.session.completed", () => {
  it("checkout combinado: liquida o pedido de cartão, provisiona e ativa o plano da empresa", async () => {
    mocks.companyFind.mockResolvedValue(company({ plan: "STARTER" }));
    const res = await deliver(checkoutCompleted());
    expect(res.status).toBe(200);

    expect(mocks.orderUpdate.mock.calls[0][0].where).toEqual({ stripeCheckoutSessionId: "cs_test_1" });
    expect(mocks.orderUpdate.mock.calls[0][0].data.status).toBe("PAID");
    expect(mocks.provision).toHaveBeenCalledWith("order_1");

    const data = mocks.companyUpdate.mock.calls[0][0].data;
    expect(mocks.companyUpdate.mock.calls[0][0].where).toEqual({ id: "co_1" });
    expect(data).toMatchObject({ plan: "STARTER", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_new", stripeSubscriptionStatus: "active" });
  });

  it("assinatura sem add-on de cartão (nenhum StoreOrder na sessão): P2025 é o caso normal, o plano ativa do mesmo jeito", async () => {
    mocks.orderUpdate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025", clientVersion: "test" }));
    const res = await deliver(checkoutCompleted());
    expect(res.status).toBe(200);
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.companyUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it("primeira assinatura agenda o e-mail de boas-vindas; reativação (já enviado antes) não reenvia", async () => {
    mocks.companyFind.mockResolvedValue(company({ subscriptionWelcomeEmailSentAt: null }));
    await deliver(checkoutCompleted());
    expect(mocks.after).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    mocks.orderUpdate.mockResolvedValue({ id: "order_2" });
    mocks.companyUpdate.mockResolvedValue({});
    mocks.companyFind.mockResolvedValue(company({ subscriptionWelcomeEmailSentAt: new Date("2026-09-01") }));
    await deliver(checkoutCompleted());
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("publica PlanoAlterado só quando o plano de fato muda", async () => {
    mocks.companyFind.mockResolvedValue(company({ plan: "STARTER" }));
    await deliver(checkoutCompleted());
    expect(mocks.publishEvent).not.toHaveBeenCalled();

    mocks.companyFind.mockResolvedValue(company({ plan: "PRO" }));
    await deliver(checkoutCompleted());
    expect(mocks.publishEvent).toHaveBeenCalledWith("PlanoAlterado", expect.objectContaining({ previousPlan: "PRO", newPlan: "STARTER", reason: "CHECKOUT_INICIAL" }), { companyId: "co_1" });
  });

  it("sessão de assinatura sem companyId/plan: 200 (não vira retry infinito), nada é gravado na empresa e o erro fica no log", async () => {
    const res = await deliver(checkoutCompleted({ metadata: {}, client_reference_id: null }));
    expect(res.status).toBe(200);
    expect(mocks.companyUpdate).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalled();
  });
});

describe("customer.subscription.* — reativação e cancelamento", () => {
  it("cancelamento da assinatura ATUAL: status canceled, volta pra Starter e agenda o e-mail", async () => {
    mocks.companyFind.mockResolvedValue(company({ plan: "PRO", stripeSubscriptionId: "sub_new" }));
    const res = await deliver(subscriptionEvent("customer.subscription.deleted", { id: "sub_new", status: "canceled" }));
    expect(res.status).toBe(200);
    expect(mocks.companyUpdate.mock.calls[0][0].data).toMatchObject({ stripeSubscriptionStatus: "canceled", plan: "STARTER" });
    expect(mocks.publishEvent).toHaveBeenCalledWith("PlanoAlterado", expect.objectContaining({ reason: "CANCELAMENTO" }), { companyId: "co_1" });
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it("evento terminal tardio de uma assinatura ANTIGA nunca derruba a assinatura atual (reativação)", async () => {
    mocks.companyFind.mockResolvedValue(company({ plan: "STARTER", stripeSubscriptionId: "sub_new", stripeSubscriptionStatus: "active" }));
    const res = await deliver(subscriptionEvent("customer.subscription.deleted", { id: "sub_old", status: "canceled" }));
    expect(res.status).toBe(200);
    expect(mocks.companyUpdate).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.publishEvent).not.toHaveBeenCalled();
  });

  it("o mesmo vale pra unpaid de assinatura antiga", async () => {
    mocks.companyFind.mockResolvedValue(company({ stripeSubscriptionId: "sub_new" }));
    await deliver(subscriptionEvent("customer.subscription.updated", { id: "sub_old", status: "unpaid" }));
    expect(mocks.companyUpdate).not.toHaveBeenCalled();
  });

  it("empresa que ainda não tem assinatura registrada aceita o evento (nada pra proteger)", async () => {
    mocks.companyFind.mockResolvedValue(company({ stripeSubscriptionId: null, stripeSubscriptionStatus: null }));
    await deliver(subscriptionEvent("customer.subscription.updated", { id: "sub_first", status: "active" }));
    expect(mocks.companyUpdate).toHaveBeenCalledTimes(1);
  });

  it("virou past_due: grava o status, marca o relógio da tolerância e agenda o aviso de cobrança", async () => {
    mocks.companyFind.mockResolvedValue(company({ stripeSubscriptionStatus: "active" }));
    await deliver(subscriptionEvent("customer.subscription.updated", { status: "past_due" }));
    const data = mocks.companyUpdate.mock.calls[0][0].data;
    expect(data.stripeSubscriptionStatus).toBe("past_due");
    expect(data.subscriptionStatusChangedAt).toBeInstanceOf(Date);
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it("reenvio do mesmo status não reinicia o relógio nem manda e-mail de novo", async () => {
    mocks.companyFind.mockResolvedValue(company({ stripeSubscriptionStatus: "past_due", billingPastDueEmailSentAt: new Date("2026-09-20") }));
    await deliver(subscriptionEvent("customer.subscription.updated", { status: "past_due" }));
    const data = mocks.companyUpdate.mock.calls[0][0].data;
    expect(data.subscriptionStatusChangedAt).toBeUndefined();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("recuperou de um atraso: libera o aviso pra um atraso futuro", async () => {
    mocks.companyFind.mockResolvedValue(company({ stripeSubscriptionStatus: "past_due", billingPastDueEmailSentAt: new Date("2026-09-20") }));
    await deliver(subscriptionEvent("customer.subscription.updated", { status: "active" }));
    expect(mocks.companyUpdate.mock.calls[0][0].data.billingPastDueEmailSentAt).toBeNull();
  });

  it("evento de assinatura sem companyId nos metadados é ignorado", async () => {
    const res = await deliver(subscriptionEvent("customer.subscription.updated", { metadata: {} }));
    expect(res.status).toBe(200);
    expect(mocks.companyFind).not.toHaveBeenCalled();
    expect(mocks.companyUpdate).not.toHaveBeenCalled();
  });
});
