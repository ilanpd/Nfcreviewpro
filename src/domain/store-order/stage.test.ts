import { describe, expect, it } from "vitest";
import {
  PLATE_COVERED_STEPS,
  columnsThrough,
  nextColumn,
  orderCoveredByPlates,
  pendingPlateSteps,
  planUndo,
  previousColumn,
  stageProgress,
  stepsToReach,
  warnsMissingPlates,
} from "./stage";
import { deriveBoardColumn } from "./board";
import type { StoreOrderChecklistLike } from "./checklist";

const BASE: StoreOrderChecklistLike = {
  status: "PAID",
  provisionedAt: new Date(),
  stockConfirmedAt: null,
  printedAt: null,
  nfcWrittenAt: null,
  qcPassedAt: null,
  packagedAt: null,
  shippedAt: null,
  deliveredAt: null,
  trackingCode: null,
  carrier: null,
};
const at = (fields: Partial<StoreOrderChecklistLike>) => ({ ...BASE, ...fields });
const withColumn = (o: StoreOrderChecklistLike) => ({ ...o, currentColumn: deriveBoardColumn(o) });
const NOW = new Date();

describe("navegação entre etapas", () => {
  it("próxima e anterior respeitam a ordem das 8 colunas e as pontas", () => {
    expect(nextColumn("PAGO")).toBe("SEPARACAO");
    expect(nextColumn("EXPEDICAO")).toBe("ENTREGUE");
    expect(nextColumn("ENTREGUE")).toBeNull();
    expect(previousColumn("SEPARACAO")).toBe("PAGO");
    expect(previousColumn("PAGO")).toBeNull();
  });

  it("os passos até uma etapa à frente vêm todos, em ordem, sem pular nenhum", () => {
    expect(stepsToReach("PAGO", "SEPARACAO")).toEqual(["STOCK_CONFIRMED"]);
    expect(stepsToReach("PAGO", "EMBALAGEM")).toEqual(["STOCK_CONFIRMED", "PRINTED", "NFC_WRITTEN", "QC_PASSED", "PACKAGED"]);
    expect(stepsToReach("QUALIDADE", "ENTREGUE")).toEqual(["PACKAGED", "SHIPPED", "DELIVERED"]);
  });

  it("lista as etapas atravessadas: exclui a de partida e inclui a de chegada", () => {
    expect(columnsThrough("PAGO", "IMPRESSAO")).toEqual(["SEPARACAO", "IMPRESSAO"]);
    expect(columnsThrough("QUALIDADE", "QUALIDADE")).toEqual([]);
    expect(columnsThrough("EMBALAGEM", "PAGO")).toEqual([]);
  });

  it("ir para a mesma etapa ou para trás não gera passo nenhum (voltar é o 'desfazer')", () => {
    expect(stepsToReach("EMBALAGEM", "EMBALAGEM")).toEqual([]);
    expect(stepsToReach("EMBALAGEM", "IMPRESSAO")).toEqual([]);
  });

  it("o progresso informa a posição entre as 8 etapas", () => {
    expect(stageProgress("PAGO")).toEqual({ index: 0, total: 8 });
    expect(stageProgress("ENTREGUE")).toEqual({ index: 7, total: 8 });
  });
});

describe("planUndo — desfazer o último passo de produção", () => {
  it("de Impressão volta para Separação e limpa exatamente o campo da impressão", () => {
    const plan = planUndo(withColumn(at({ stockConfirmedAt: NOW, printedAt: NOW })));
    expect(plan).toEqual({ ok: true, from: "IMPRESSAO", to: "SEPARACAO", field: "printedAt" });
  });

  it("de Embalagem volta para Qualidade (o último passo que ainda pode ser desfeito)", () => {
    const plan = planUndo(withColumn(at({ stockConfirmedAt: NOW, printedAt: NOW, nfcWrittenAt: NOW, qcPassedAt: NOW, packagedAt: NOW })));
    expect(plan).toMatchObject({ ok: true, to: "QUALIDADE", field: "packagedAt" });
  });

  it("na primeira etapa não há o que desfazer", () => {
    const plan = planUndo(withColumn(at({})));
    expect(plan.ok).toBe(false);
    expect(plan.ok === false && plan.reason).toMatch(/primeira etapa/);
  });

  it("pedido já enviado ou entregue NÃO volta — o cliente já recebeu o e-mail", () => {
    const base = { stockConfirmedAt: NOW, printedAt: NOW, nfcWrittenAt: NOW, qcPassedAt: NOW, packagedAt: NOW };
    const shipped = planUndo(withColumn(at({ ...base, status: "SHIPPED", shippedAt: NOW })));
    expect(shipped.ok).toBe(false);
    const delivered = planUndo(withColumn(at({ ...base, status: "DELIVERED", shippedAt: NOW, deliveredAt: NOW })));
    expect(delivered.ok).toBe(false);
    // a razão é a específica (o cliente já recebeu o e-mail), não a genérica de "não está só pago"
    expect(shipped.ok === false && shipped.reason).toMatch(/já foi enviado ao cliente/);
    expect(delivered.ok === false && delivered.reason).toMatch(/já foi enviado ao cliente/);
  });

  it("pedido cancelado, reembolsado ou aguardando pagamento também não desfaz nada", () => {
    for (const status of ["CANCELED", "REFUNDED", "PENDING_PAYMENT"] as const) {
      expect(planUndo(withColumn(at({ status, stockConfirmedAt: NOW }))).ok).toBe(false);
    }
  });
});

describe("o que a placa do estoque já cumpre", () => {
  it("separação, impressão, gravação do chip e teste — nunca embalagem nem envio", () => {
    expect(PLATE_COVERED_STEPS).toEqual(["STOCK_CONFIRMED", "PRINTED", "NFC_WRITTEN", "QC_PASSED"]);
  });

  it("só conta como coberto quando TODOS os cartões têm placa conferida", () => {
    const cards = ["c1", "c2"];
    expect(orderCoveredByPlates(cards, [{ cardId: "c1", status: "VERIFIED" }, { cardId: "c2", status: "VERIFIED" }])).toBe(true);
    expect(orderCoveredByPlates(cards, [{ cardId: "c1", status: "VERIFIED" }])).toBe(false);
    expect(orderCoveredByPlates(cards, [{ cardId: "c1", status: "VERIFIED" }, { cardId: "c2", status: "IN_PRODUCTION" }])).toBe(false);
    expect(orderCoveredByPlates(cards, [{ cardId: "c1", status: "VERIFIED" }, { cardId: "c2", status: "DEFECTIVE" }])).toBe(false);
  });

  it("pedido sem cartão nenhum nunca é considerado coberto", () => {
    expect(orderCoveredByPlates([], [])).toBe(false);
  });

  it("lista só os passos que o pedido ainda não registrou", () => {
    expect(pendingPlateSteps(at({}))).toEqual(PLATE_COVERED_STEPS);
    expect(pendingPlateSteps(at({ stockConfirmedAt: NOW, nfcWrittenAt: NOW }))).toEqual(["PRINTED", "QC_PASSED"]);
    expect(pendingPlateSteps(at({ stockConfirmedAt: NOW, printedAt: NOW, nfcWrittenAt: NOW, qcPassedAt: NOW }))).toEqual([]);
  });
});

describe("aviso de placa faltando", () => {
  it("só avisa a partir da embalagem, e só quando falta placa em algum cartão", () => {
    expect(warnsMissingPlates("SEPARACAO", 2, 0)).toBe(false);
    expect(warnsMissingPlates("QUALIDADE", 2, 0)).toBe(false);
    expect(warnsMissingPlates("EMBALAGEM", 2, 1)).toBe(true);
    expect(warnsMissingPlates("EXPEDICAO", 1, 0)).toBe(true);
    expect(warnsMissingPlates("ENTREGUE", 3, 3)).toBe(false);
  });

  it("pedido sem cartões provisionados não dispara o aviso (não há o que atribuir)", () => {
    expect(warnsMissingPlates("EXPEDICAO", 0, 0)).toBe(false);
  });
});
