import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Guarda do checkout de assinatura (C15, ADR-090). O Stripe/Clerk/Prisma são
 * mocks — o que está sob teste é a regra da rota: o pacote de cartões somado
 * à assinatura nunca passa do que o plano permite usar (o bug de auditoria:
 * um Starter, `cardLimit: 1`, saía daqui com um pedido de 20 cartões), a
 * `success_url` leva pra ativação pós-pagamento, e quem já tem assinatura
 * viva não abre uma segunda.
 */
const mocks = vi.hoisted(() => {
  // `lib/plans.ts` lê os Price ids do ambiente NO CARREGAMENTO do módulo
  // (`STRIPE_PRICE_ENV`), então isto precisa existir antes do import da rota —
  // `vi.hoisted` roda antes dos imports. PRO fica de fora de propósito: é o
  // caso "plano congelado, sem Price" (503).
  process.env.STRIPE_PRICE_STARTER = "price_starter_test";
  delete process.env.STRIPE_PRICE_PRO;
  delete process.env.STRIPE_PRICE_BUSINESS;
  return {
    requireAuthContext: vi.fn(),
    sessionsCreate: vi.fn(),
    findCompany: vi.fn(),
    createOrder: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext, requirePermission: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripe: { checkout: { sessions: { create: mocks.sessionsCreate } } } }));
vi.mock("@/lib/prisma", () => ({
  prisma: { company: { findUniqueOrThrow: mocks.findCompany }, storeOrder: { create: mocks.createOrder } },
}));
vi.mock("@/lib/site-settings", () => ({ getSiteSettings: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api-error", () => ({
  handleApiError: (error: unknown) => NextResponse.json({ error: String(error) }, { status: 500 }),
}));

import { POST } from "./route";

const CARD_FIELDS = {
  destinationUrl: "https://g.page/r/bella-vista/review",
  customerDocument: "11122233396",
  customerPhone: "11987654321",
};

function post(body: unknown) {
  return POST(new NextRequest("http://localhost/api/billing/checkout", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
  mocks.requireAuthContext.mockResolvedValue({ companyId: "co_1", email: "dono@example.com" });
  mocks.findCompany.mockResolvedValue({ id: "co_1", name: "Bella Vista", stripeCustomerId: null, stripeSubscriptionId: null, stripeSubscriptionStatus: null });
  mocks.sessionsCreate.mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/billing/checkout", () => {
  it("Starter + pacote de 20 cartões: recusa (400) e nunca abre sessão nem cria pedido", async () => {
    const res = await post({ plan: "STARTER", cardProductId: "pack-20", ...CARD_FIELDS });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("permite 1 cartão");
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("destino do cartão com esquema perigoso (data:) é recusado antes de qualquer sessão ou pedido", async () => {
    const res = await post({ plan: "STARTER", cardProductId: "single", ...CARD_FIELDS, destinationUrl: "data:text/html,<script>alert(1)</script>" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("Starter + 50 cartões também é recusado", async () => {
    const res = await post({ plan: "STARTER", cardProductId: "pack-50", ...CARD_FIELDS });
    expect(res.status).toBe(400);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("Starter + 1 cartão: uma sessão só (plano + cartão), pedido CARD_PLUS_SAAS e success_url na ativação", async () => {
    const res = await post({ plan: "STARTER", cardProductId: "single", ...CARD_FIELDS });
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://checkout.stripe.test/cs_test_1");

    const session = mocks.sessionsCreate.mock.calls[0][0];
    expect(session.mode).toBe("subscription");
    expect(session.line_items).toHaveLength(2);
    expect(session.line_items[0]).toEqual({ price: "price_starter_test", quantity: 1 });
    expect(session.line_items[1].quantity).toBe(1);
    expect(session.success_url).toBe("https://app.test/onboarding/ativar");
    expect(session.cancel_url).toContain("/onboarding/plan");

    const order = mocks.createOrder.mock.calls[0][0].data;
    expect(order.orderType).toBe("CARD_PLUS_SAAS");
    expect(order.companyId).toBe("co_1");
    expect(order.quantity).toBe(1);
  });

  it("Starter sem cartão (Fluxo 2, já tem o cartão): só o plano, sem endereço e sem pedido", async () => {
    const res = await post({ plan: "STARTER" });
    expect(res.status).toBe(200);
    const session = mocks.sessionsCreate.mock.calls[0][0];
    expect(session.line_items).toEqual([{ price: "price_starter_test", quantity: 1 }]);
    expect(session.shipping_address_collection).toBeUndefined();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("quem já tem assinatura viva não abre uma segunda (409)", async () => {
    mocks.findCompany.mockResolvedValue({ id: "co_1", name: "Bella Vista", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", stripeSubscriptionStatus: "active" });
    const res = await post({ plan: "STARTER" });
    expect(res.status).toBe(409);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("assinatura cancelada pode reativar (Fluxo 6): abre um checkout novo", async () => {
    mocks.findCompany.mockResolvedValue({ id: "co_1", name: "Bella Vista", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", stripeSubscriptionStatus: "canceled" });
    const res = await post({ plan: "STARTER" });
    expect(res.status).toBe(200);
    expect(mocks.sessionsCreate.mock.calls[0][0].customer).toBe("cus_1");
  });

  it("plano sem Price configurado (Pro/Business congelados) responde 503, nunca uma sessão quebrada", async () => {
    const res = await post({ plan: "PRO" });
    expect(res.status).toBe(503);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });
});
