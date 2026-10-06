import { describe, expect, it } from "vitest";
import { successView } from "./success-view";

describe("successView — o que /loja/sucesso afirma", () => {
  it("sem pedido: nunca diz que está confirmado", () => {
    const v = successView(null);
    expect(v.kind).toBe("NOT_FOUND");
    expect(v.title).not.toMatch(/confirmado!/i);
    expect(v.autoRefresh).toBe(false);
  });

  it("pagamento pendente: avisa que está confirmando e se atualiza sozinha", () => {
    const v = successView({ status: "PENDING_PAYMENT" });
    expect(v.kind).toBe("AWAITING_PAYMENT");
    expect(v.title).toMatch(/Confirmando/);
    expect(v.title).not.toMatch(/Pedido confirmado!/);
    expect(v.autoRefresh).toBe(true);
  });

  it.each(["PAID", "SHIPPED", "DELIVERED"] as const)("%s: pedido confirmado, sem texto de espera", (status) => {
    const v = successView({ status });
    expect(v.kind).toBe("CONFIRMED");
    expect(v.title).toBe("Pedido confirmado!");
    expect(v.description).toBeNull();
    expect(v.autoRefresh).toBe(false);
  });

  it("cancelado: diz que foi cancelado, nunca confirmado", () => {
    const v = successView({ status: "CANCELED" });
    expect(v.kind).toBe("CANCELED");
    expect(v.title).toBe("Pedido cancelado");
    expect(v.autoRefresh).toBe(false);
  });

  it("reembolsado: diz que foi reembolsado, nunca confirmado (antes caía no layout de confirmado)", () => {
    const v = successView({ status: "REFUNDED" });
    expect(v.kind).toBe("REFUNDED");
    expect(v.title).toBe("Pedido reembolsado");
    expect(v.title).not.toMatch(/confirmado!/i);
  });

  it("só o pagamento pendente atualiza sozinho", () => {
    const statuses = ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "CANCELED", "REFUNDED"] as const;
    expect(statuses.filter((s) => successView({ status: s }).autoRefresh)).toEqual(["PENDING_PAYMENT"]);
  });
});
