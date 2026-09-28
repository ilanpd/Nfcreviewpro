import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Guarda do checkout da Loja (C15, ADR-090). Achado de auditoria: um assinante
 * já logado (CUSTOMER) conseguia comprar, pela Loja pública, mais cartões do
 * que o próprio plano permite usar (Starter, `cardLimit: 1`, comprando um
 * pacote de 20). A trava vale SÓ pra CUSTOMER: um convidado (GUEST, sem
 * assinatura) e quem nem está logado sempre puderam comprar em lote — é um
 * caso de uso real (`services/card.service.ts`, comentário de `createCard`),
 * nunca bloquear.
 */
const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  sessionsCreate: vi.fn(),
  findCompany: vi.fn(),
  countCards: vi.fn(),
  createOrder: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.getAuthContext }));
vi.mock("@/lib/stripe", () => ({ stripe: { checkout: { sessions: { create: mocks.sessionsCreate } } } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findUnique: mocks.findCompany },
    nFCCard: { count: mocks.countCards },
    storeOrder: { create: mocks.createOrder },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/ip", () => ({ getRequestIp: vi.fn().mockResolvedValue("203.0.113.7") }));
vi.mock("@/lib/site-settings", () => ({ getSiteSettings: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api-error", () => ({
  // Mesmo mapeamento do real (lib/api-error.ts) pro que estes testes observam.
  handleApiError: (error: unknown) =>
    error instanceof Error && error.message === "RATE_LIMITED"
      ? NextResponse.json({ error: "Muitas requisições" }, { status: 429 })
      : NextResponse.json({ error: String(error) }, { status: 500 }),
}));

import { POST } from "./route";

function buy(productId: string, destinationUrl = "https://instagram.com/bella") {
  return POST(
    new NextRequest("http://localhost/api/store/checkout", {
      method: "POST",
      body: JSON.stringify({
        productId,
        destinationUrl,
        customerName: "Bella Vista",
        customerEmail: "dono@example.com",
        customerDocument: "11122233396",
        customerPhone: "11987654321",
      }),
    })
  );
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
  mocks.sessionsCreate.mockResolvedValue({ id: "cs_store_1", url: "https://checkout.stripe.test/cs_store_1" });
  mocks.getAuthContext.mockResolvedValue(null);
  mocks.countCards.mockResolvedValue(0);
  mocks.rateLimit.mockResolvedValue({ success: true, remaining: 9 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/store/checkout — limite do plano só pra assinante logado", () => {
  it("assinante Starter que já tem 1 cartão e tenta comprar mais 1: recusa (409), sem sessão nem pedido", async () => {
    mocks.getAuthContext.mockResolvedValue({ companyId: "co_1" });
    mocks.findCompany.mockResolvedValue({ plan: "STARTER", accountType: "CUSTOMER" });
    mocks.countCards.mockResolvedValue(1);

    const res = await buy("single");
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("permite 1 cartão");
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("assinante Starter sem nenhum cartão comprando 1: passa e o pedido fica ligado à empresa", async () => {
    mocks.getAuthContext.mockResolvedValue({ companyId: "co_1" });
    mocks.findCompany.mockResolvedValue({ plan: "STARTER", accountType: "CUSTOMER" });
    mocks.countCards.mockResolvedValue(0);

    const res = await buy("single");
    expect(res.status).toBe(200);
    expect(mocks.createOrder.mock.calls[0][0].data.companyId).toBe("co_1");
  });

  it("assinante Starter comprando um pacote de 20 (passaria do limite): recusa mesmo com 0 cartões", async () => {
    mocks.getAuthContext.mockResolvedValue({ companyId: "co_1" });
    mocks.findCompany.mockResolvedValue({ plan: "STARTER", accountType: "CUSTOMER" });

    const res = await buy("pack-20");
    expect(res.status).toBe(409);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("plano sem teto de cartões (Business) compra qualquer pacote", async () => {
    mocks.getAuthContext.mockResolvedValue({ companyId: "co_2" });
    mocks.findCompany.mockResolvedValue({ plan: "BUSINESS", accountType: "CUSTOMER" });
    mocks.countCards.mockResolvedValue(200);

    expect((await buy("pack-50")).status).toBe(200);
  });

  it("convidado (GUEST, sem assinatura) compra em lote livremente — de propósito", async () => {
    mocks.getAuthContext.mockResolvedValue({ companyId: "co_guest" });
    mocks.findCompany.mockResolvedValue({ plan: "STARTER", accountType: "GUEST" });
    mocks.countCards.mockResolvedValue(5);

    expect((await buy("pack-20")).status).toBe(200);
    expect(mocks.countCards).not.toHaveBeenCalled();
  });

  it("destino com esquema perigoso (javascript:) é recusado antes de qualquer sessão ou pedido", async () => {
    const res = await buy("single", "javascript:alert(1)");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("IP que estourou o limite recebe 429 antes de qualquer trabalho (sem sessão, sem pedido)", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await buy("single");
    expect(res.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith("storeCheckout", "203.0.113.7");
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("quem nem está logado compra qualquer pacote (Fluxo 1, a Loja pública)", async () => {
    expect((await buy("pack-20")).status).toBe(200);
    expect(mocks.findCompany).not.toHaveBeenCalled();
    expect(mocks.createOrder.mock.calls[0][0].data.companyId).toBeUndefined();
  });
});
