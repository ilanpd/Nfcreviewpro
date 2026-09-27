import { describe, expect, it } from "vitest";
import { buildAttentionRadar, type AttentionRadarInput } from "./attention-radar";

const EMPTY: AttentionRadarInput = {
  stuckOrders: [],
  lowStock: null,
  disputedOrders: [],
  negativeReviewCompanies: [],
  stuckSupportRequests: [],
};

describe("buildAttentionRadar — endereço do cartão (ADR-076)", () => {
  it("sem nada de errado, o radar vem vazio (nunca um insight de exemplo)", () => {
    expect(buildAttentionRadar(EMPTY)).toEqual([]);
    expect(buildAttentionRadar({ ...EMPTY, cardUrl: null })).toEqual([]);
  });

  it("endereço definitivo não gera alerta, mesmo com pedidos em produção", () => {
    const radar = buildAttentionRadar({ ...EMPTY, cardUrl: { kind: "final", host: "pulse.com.br", blocked: false, pendingOrders: 5 } });
    expect(radar).toEqual([]);
  });

  it("endereço provisório sem pedido em produção não alerta: ninguém está gravando chip", () => {
    const radar = buildAttentionRadar({ ...EMPTY, cardUrl: { kind: "provisional", host: "x.vercel.app", blocked: false, pendingOrders: 0 } });
    expect(radar).toEqual([]);
  });

  it("endereço provisório com pedido em produção avisa para não gravar chip", () => {
    const radar = buildAttentionRadar({ ...EMPTY, cardUrl: { kind: "provisional", host: "x.vercel.app", blocked: false, pendingOrders: 1 } });
    expect(radar).toHaveLength(1);
    expect(radar[0].id).toBe("card-url");
    expect(radar[0].severity).toBe("attention");
    expect(radar[0].message).toContain("x.vercel.app");
    expect(radar[0].message).toContain("1 pedido em produção");
    expect(radar[0].message).toContain("não grave chips");
  });

  it("quando o ambiente já bloqueia a gravação, o alerta diz que está bloqueada e pluraliza", () => {
    const radar = buildAttentionRadar({ ...EMPTY, cardUrl: { kind: "invalid", host: "", blocked: true, pendingOrders: 3 } });
    expect(radar[0].message).toContain("bloqueada");
    expect(radar[0].message).toContain("3 pedidos em produção");
    expect(radar[0].message).toContain("inválido");
  });
});
