import { describe, expect, it } from "vitest";
import { buildOrderChecklist, currentStageLabel, isOrderInProgress, type StoreOrderChecklistLike } from "./checklist";

function order(overrides: Partial<StoreOrderChecklistLike> = {}): StoreOrderChecklistLike {
  return {
    status: "PENDING_PAYMENT",
    provisionedAt: null,
    stockConfirmedAt: null,
    printedAt: null,
    nfcWrittenAt: null,
    qcPassedAt: null,
    packagedAt: null,
    shippedAt: null,
    deliveredAt: null,
    trackingCode: null,
    carrier: null,
    ...overrides,
  };
}

describe("buildOrderChecklist", () => {
  it("marks nothing done for a pending-payment order", () => {
    const steps = buildOrderChecklist(order());
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("marks PAID done as soon as status leaves PENDING_PAYMENT/CANCELED", () => {
    const steps = buildOrderChecklist(order({ status: "PAID" }));
    expect(steps.find((s) => s.key === "PAID")?.done).toBe(true);
  });

  it("never marks PAID done for a canceled order, even if status started as PAID", () => {
    const steps = buildOrderChecklist(order({ status: "CANCELED" }));
    expect(steps.find((s) => s.key === "PAID")?.done).toBe(false);
  });

  it("marks each granular step done exactly when its timestamp is set", () => {
    const now = new Date();
    const steps = buildOrderChecklist(order({ status: "PAID", nfcWrittenAt: now }));
    expect(steps.find((s) => s.key === "WRITTEN")?.done).toBe(true);
    expect(steps.find((s) => s.key === "QC")?.done).toBe(false);
  });
});

describe("currentStageLabel", () => {
  it("reports a canceled order distinctly from every other state", () => {
    expect(currentStageLabel(order({ status: "CANCELED", deliveredAt: new Date() }))).toBe("Pedido cancelado");
  });

  it("reports delivered as the final, unambiguous state", () => {
    expect(currentStageLabel(order({ status: "DELIVERED", deliveredAt: new Date() }))).toBe("Entregue");
  });

  it("includes the tracking code and carrier once shipped", () => {
    const label = currentStageLabel(
      order({ status: "SHIPPED", shippedAt: new Date(), trackingCode: "BR123", carrier: "Correios" })
    );
    expect(label).toContain("Correios");
    expect(label).toContain("BR123");
  });

  it("falls back to a plain 'a caminho' when shipped without a tracking code", () => {
    expect(currentStageLabel(order({ status: "SHIPPED", shippedAt: new Date() }))).toBe("A caminho");
  });

  it("walks backward through the checklist to find the latest real milestone", () => {
    expect(currentStageLabel(order({ status: "PAID", stockConfirmedAt: new Date() }))).toBe(
      "Estoque confirmado, preparando produção"
    );
    expect(currentStageLabel(order({ status: "PAID" }))).toBe("Pagamento confirmado, preparando produção");
    expect(currentStageLabel(order())).toBe("Aguardando confirmação do pagamento");
  });
});

describe("isOrderInProgress", () => {
  it("is false only for the two terminal statuses", () => {
    expect(isOrderInProgress("DELIVERED")).toBe(false);
    expect(isOrderInProgress("CANCELED")).toBe(false);
    expect(isOrderInProgress("PENDING_PAYMENT")).toBe(true);
    expect(isOrderInProgress("PAID")).toBe(true);
    expect(isOrderInProgress("SHIPPED")).toBe(true);
  });
});
