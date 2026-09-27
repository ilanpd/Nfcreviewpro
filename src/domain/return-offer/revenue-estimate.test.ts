import { describe, expect, it } from "vitest";
import { estimateReturnRevenue } from "./revenue-estimate";

describe("estimateReturnRevenue", () => {
  it("sem ticket médio configurado, não estima nada (nunca inventa um número)", () => {
    expect(estimateReturnRevenue(20, null)).toEqual({ configured: false, estimatedCents: null, redeemed: 20 });
    expect(estimateReturnRevenue(20, 0)).toMatchObject({ configured: false, estimatedCents: null });
  });

  it("o exemplo do material comercial: R$45 de ticket e 20 clientes voltando dá R$900", () => {
    expect(estimateReturnRevenue(20, 45)).toEqual({ configured: true, estimatedCents: 90000, redeemed: 20 });
  });

  it("a tabela do material comercial (R$25/R$45/R$80/R$150, 1 cliente)", () => {
    expect(estimateReturnRevenue(1, 25).estimatedCents).toBe(2500);
    expect(estimateReturnRevenue(1, 45).estimatedCents).toBe(4500);
    expect(estimateReturnRevenue(1, 80).estimatedCents).toBe(8000);
    expect(estimateReturnRevenue(1, 150).estimatedCents).toBe(15000);
  });

  it("zero resgates com ticket configurado dá zero, não 'não configurado'", () => {
    expect(estimateReturnRevenue(0, 45)).toEqual({ configured: true, estimatedCents: 0, redeemed: 0 });
  });

  it("centavos arredondam para o inteiro mais próximo", () => {
    expect(estimateReturnRevenue(3, 33.33).estimatedCents).toBe(9999);
  });
});
