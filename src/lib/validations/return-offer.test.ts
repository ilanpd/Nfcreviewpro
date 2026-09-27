import { describe, expect, it } from "vitest";
import { lookupInputSchema, offerInputSchema, pinInputSchema, redeemInputSchema, voidInputSchema, voucherListQuerySchema } from "./return-offer";

const validOffer = { title: "Hidratação grátis", windowDays: 14, cooldownDays: 30, active: false };

describe("offerInputSchema", () => {
  it("aceita a configuração padrão dos materiais", () => {
    expect(offerInputSchema.safeParse(validOffer).success).toBe(true);
  });

  it.each([
    ["janela zero", { windowDays: 0 }],
    ["janela acima de 90 dias", { windowDays: 91 }],
    ["carência negativa", { cooldownDays: -1 }],
    ["carência acima de 365 dias", { cooldownDays: 366 }],
    ["teto diário zero", { dailyCap: 0 }],
    ["título curto demais", { title: "Oi" }],
    ["link sem protocolo", { primaryUrl: "instagram.com/loja" }],
    ["link com protocolo perigoso", { primaryUrl: "javascript:alert(1)" }],
  ])("recusa %s", (_nome, patch) => {
    expect(offerInputSchema.safeParse({ ...validOffer, ...patch }).success).toBe(false);
  });

  it("aceita teto diário nulo e link do Instagram", () => {
    expect(offerInputSchema.safeParse({ ...validOffer, dailyCap: null, primaryUrl: "https://instagram.com/loja" }).success).toBe(true);
  });

  it("recusa título e descrição que citam avaliação, com a explicação em português", () => {
    const title = offerInputSchema.safeParse({ ...validOffer, title: "Ganhe um café ao avaliar" });
    expect(title.success).toBe(false);
    if (!title.success) expect(title.error.issues[0].message).toMatch(/proibido pelo Google/);
    expect(offerInputSchema.safeParse({ ...validOffer, description: "Cupom por 5 estrelas" }).success).toBe(false);
  });

  it("apara espaços do título", () => {
    const result = offerInputSchema.parse({ ...validOffer, title: "  Café grátis  " });
    expect(result.title).toBe("Café grátis");
  });
});

describe("pinInputSchema", () => {
  it("aceita um PIN de 4 números que não seja fraco", () => {
    expect(pinInputSchema.safeParse({ pin: "4821" }).success).toBe(true);
  });
  it.each(["1234", "0000", "9876", "12", "12345", "abcd"])("recusa %s", (pin) => {
    expect(pinInputSchema.safeParse({ pin }).success).toBe(false);
  });
});

describe("redeemInputSchema / lookupInputSchema", () => {
  it("o resgate exige o PIN de 4 números, mesmo o que seria fraco (quem confere é o hash)", () => {
    expect(redeemInputSchema.safeParse({ cardCode: "eau83khw", code: "K7X-4QM", pin: "1234" }).success).toBe(true);
    expect(redeemInputSchema.safeParse({ cardCode: "eau83khw", code: "K7X-4QM", pin: "12" }).success).toBe(false);
  });
  it("a consulta não pede PIN", () => {
    expect(lookupInputSchema.safeParse({ cardCode: "eau83khw", code: "k7x 4qm" }).success).toBe(true);
    expect(lookupInputSchema.safeParse({ cardCode: "ab", code: "K7X" }).success).toBe(false);
  });
});

describe("voidInputSchema / voucherListQuerySchema", () => {
  it("anular exige um motivo", () => {
    expect(voidInputSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(voidInputSchema.safeParse({ reason: "Resgate por engano" }).success).toBe(true);
  });
  it("a listagem tem padrão de 50 e teto de 100", () => {
    expect(voucherListQuerySchema.parse({}).take).toBe(50);
    expect(voucherListQuerySchema.safeParse({ take: "500" }).success).toBe(false);
    expect(voucherListQuerySchema.safeParse({ status: "OUTRO" }).success).toBe(false);
    expect(voucherListQuerySchema.parse({ status: "REDEEMED", take: "10" })).toEqual({ status: "REDEEMED", take: 10 });
  });
});
