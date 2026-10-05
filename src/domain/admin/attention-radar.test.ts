import { describe, expect, it } from "vitest";
import { buildAttentionRadar, type AttentionRadarInput } from "./attention-radar";

const EMPTY: AttentionRadarInput = {
  stuckOrders: [],
  lowStock: null,
  disputedOrders: [],
  unresolvedFeedbackCompanies: [],
  stuckSupportRequests: [],
};

describe("buildAttentionRadar — chips NFC em branco", () => {
  it("estoque baixo, mas positivo, diz quantos restam", () => {
    const radar = buildAttentionRadar({ ...EMPTY, lowStock: { blankChipStock: 8, lowStockThreshold: 20 } });
    expect(radar).toHaveLength(1);
    expect(radar[0].message).toBe("Estoque de chips NFC abaixo do mínimo — restam 8 unidades");
  });

  it("estoque negativo (pedidos pagos sem chip) diz quantos faltam, nunca um número negativo", () => {
    const radar = buildAttentionRadar({ ...EMPTY, lowStock: { blankChipStock: -48, lowStockThreshold: 20 } });
    expect(radar).toHaveLength(1);
    expect(radar[0].message).toBe("Faltam 48 chips NFC em branco para cobrir os pedidos já pagos");
    expect(radar[0].message).not.toContain("-");
  });

  it("estoque no mínimo ou acima não alerta", () => {
    expect(buildAttentionRadar({ ...EMPTY, lowStock: { blankChipStock: 20, lowStockThreshold: 20 } })).toEqual([]);
  });
});

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

describe("buildAttentionRadar — mensagens sem resposta (auditoria 28/09/2026)", () => {
  it("abaixo do limiar (3), não alerta", () => {
    const radar = buildAttentionRadar({ ...EMPTY, unresolvedFeedbackCompanies: [{ companyId: "co_1", companyName: "Bella Vista", count: 2 }] });
    expect(radar).toEqual([]);
  });

  it("no limiar (3) ou acima, alerta com o nome da empresa e a contagem", () => {
    const radar = buildAttentionRadar({ ...EMPTY, unresolvedFeedbackCompanies: [{ companyId: "co_1", companyName: "Bella Vista", count: 5 }] });
    expect(radar).toHaveLength(1);
    expect(radar[0].id).toBe("feedback:co_1");
    expect(radar[0].severity).toBe("attention");
    expect(radar[0].message).toBe("Bella Vista tem 5 mensagens de clientes sem resposta nos últimos 7 dias");
  });

  it("nunca menciona estrela ou avaliação — o sinal não é mais RatingEvent", () => {
    const radar = buildAttentionRadar({ ...EMPTY, unresolvedFeedbackCompanies: [{ companyId: "co_1", companyName: "Bella Vista", count: 10 }] });
    expect(radar[0].message).not.toMatch(/estrela|avalia/i);
  });

  it("várias empresas acima do limiar geram um alerta cada", () => {
    const radar = buildAttentionRadar({
      ...EMPTY,
      unresolvedFeedbackCompanies: [
        { companyId: "co_1", companyName: "Bella Vista", count: 3 },
        { companyId: "co_2", companyName: "Padaria Sol", count: 4 },
      ],
    });
    expect(radar.map((r) => r.id)).toEqual(["feedback:co_1", "feedback:co_2"]);
  });
});

describe("buildAttentionRadar — estoque de placas (ADR-092)", () => {
  it("campos ausentes nunca alertam", () => {
    expect(buildAttentionRadar({ ...EMPTY, plateStock: [], plateBatches: [] })).toEqual([]);
    expect(buildAttentionRadar(EMPTY)).toEqual([]);
  });

  it("estoque abaixo do mínimo alerta com o modelo, o que há e o que está a caminho", () => {
    const radar = buildAttentionRadar({ ...EMPTY, plateStock: [{ modelId: "m1", modelName: "Avaliação", inStock: 2, minStock: 5, incoming: 0 }] });
    expect(radar).toHaveLength(1);
    expect(radar[0].id).toBe("plate-stock:m1");
    expect(radar[0].severity).toBe("attention");
    expect(radar[0].message).toBe('Estoque de placas "Avaliação" abaixo do mínimo — 2 conferidas (mínimo 5)');

    const withIncoming = buildAttentionRadar({ ...EMPTY, plateStock: [{ modelId: "m1", modelName: "Avaliação", inStock: 1, minStock: 5, incoming: 3 }] });
    expect(withIncoming[0].message).toBe('Estoque de placas "Avaliação" abaixo do mínimo — 1 conferida (mínimo 5), 3 a caminho');
  });

  it("lote na gráfica só alerta a partir de 10 dias", () => {
    expect(buildAttentionRadar({ ...EMPTY, plateBatches: [{ id: "b1", code: "L001", kind: "AT_SUPPLIER", days: 9 }] })).toEqual([]);
    const radar = buildAttentionRadar({ ...EMPTY, plateBatches: [{ id: "b1", code: "L001", kind: "AT_SUPPLIER", days: 10 }] });
    expect(radar[0].id).toBe("plate-batch:b1");
    expect(radar[0].message).toBe("Lote L001 está na gráfica há 10 dias sem ser marcado como recebido");
  });

  it("lote recebido só alerta depois de 2 dias e se ainda há placa sem conferir", () => {
    expect(buildAttentionRadar({ ...EMPTY, plateBatches: [{ id: "b1", code: "L001", kind: "AWAITING_CHECK", days: 1, pending: 5 }] })).toEqual([]);
    expect(buildAttentionRadar({ ...EMPTY, plateBatches: [{ id: "b1", code: "L001", kind: "AWAITING_CHECK", days: 5, pending: 0 }] })).toEqual([]);
    const radar = buildAttentionRadar({ ...EMPTY, plateBatches: [{ id: "b1", code: "L001", kind: "AWAITING_CHECK", days: 3, pending: 1 }] });
    expect(radar[0].message).toBe("Lote L001 foi recebido há 3 dias e ainda tem 1 placa sem conferir");
    expect(radar[0].severity).toBe("neutral");
  });
});

describe("buildAttentionRadar — provedor de e-mail (auditoria de potencial de venda, 29/09/2026)", () => {
  it("campo ausente (undefined) nunca alerta — continua opcional pra quem ainda não o calcula", () => {
    expect(buildAttentionRadar(EMPTY)).toEqual([]);
  });

  it("configurado (true) não alerta", () => {
    expect(buildAttentionRadar({ ...EMPTY, emailProviderConfigured: true })).toEqual([]);
  });

  it("false explícito alerta — /contato promete envio que não acontece", () => {
    const radar = buildAttentionRadar({ ...EMPTY, emailProviderConfigured: false });
    expect(radar).toHaveLength(1);
    expect(radar[0].id).toBe("email-provider");
    expect(radar[0].severity).toBe("attention");
    expect(radar[0].message).toContain("RESEND_API_KEY");
  });
});
