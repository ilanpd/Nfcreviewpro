import { beforeEach, describe, expect, it, vi } from "vitest";

// Estoque de placas (ADR-092). Estes testes protegem o que, se errado, quebra
// uma placa na mão do cliente: o QR impresso precisa continuar levando ao
// cartão certo depois que a placa é atribuída, trocada ou devolvida.

const mocks = vi.hoisted(() => {
  const prisma = {
    $transaction: vi.fn(),
    plate: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
    plateEvent: { create: vi.fn(), createMany: vi.fn() },
    plateBatch: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    plateModel: { findUnique: vi.fn() },
    nFCCard: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    storeOrder: { findUnique: vi.fn(), findMany: vi.fn() },
  };
  return { prisma, invalidateCard: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/resolution-engine/cache", () => ({ invalidateCard: mocks.invalidateCard }));
vi.mock("@/lib/card-url", () => ({ cardPublicUrl: (code: string) => `https://pulse.test/r/${code}` }));

import {
  PlateError,
  assignPlateToCard,
  assignPlatesToOrder,
  createStockBatch,
  resolvePlatePick,
  setPlateChecks,
  unassignPlate,
} from "./plates.service";

const { prisma } = mocks;

function plate(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    serial: "L001-07",
    uniqueCode: "plate0001",
    status: "VERIFIED",
    cardId: null,
    nfcChecked: true,
    qrChecked: true,
    serialChecked: true,
    ...overrides,
  };
}

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    name: "Cartão loja ABC #1",
    uniqueCode: "card0001",
    company: { name: "Padaria Sol", accountType: "GUEST" },
    plate: null,
    ...overrides,
  };
}

beforeEach(() => {
  // reset (não só clear): um `mockRejectedValue` de um teste não pode vazar para o seguinte.
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation(async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])));
});

describe("assignPlateToCard", () => {
  it("o cartão passa a usar o código da placa, a placa passa a ter dono e o cache dos dois códigos é limpo", async () => {
    prisma.plate.findUnique.mockResolvedValue(plate());
    prisma.nFCCard.findUnique.mockResolvedValue(card());

    const result = await assignPlateToCard({ plateId: "p1", cardId: "c1" }, "admin@x.com");

    expect(prisma.nFCCard.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { uniqueCode: "plate0001" } });
    expect(prisma.plate.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: expect.objectContaining({ cardId: "c1" }) });
    expect(prisma.plateEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ plateId: "p1", type: "ASSIGNED", actor: "admin@x.com", note: expect.stringContaining("card0001 → plate0001") }),
    });
    expect(result).toMatchObject({ codeChanged: true, previousCode: "card0001", uniqueCode: "plate0001" });
    expect(mocks.invalidateCard).toHaveBeenCalledWith("card0001");
    expect(mocks.invalidateCard).toHaveBeenCalledWith("plate0001");
  });

  it("recusa uma placa que ainda não foi conferida — e não mexe em nada", async () => {
    prisma.plate.findUnique.mockResolvedValue(plate({ status: "IN_PRODUCTION" }));
    prisma.nFCCard.findUnique.mockResolvedValue(card());

    await expect(assignPlateToCard({ plateId: "p1", cardId: "c1" }, "a")).rejects.toThrow(/ainda não foi conferida/);
    expect(prisma.nFCCard.update).not.toHaveBeenCalled();
    expect(prisma.plate.update).not.toHaveBeenCalled();
  });

  it("recusa uma placa defeituosa e uma placa que já é de outro cliente", async () => {
    prisma.nFCCard.findUnique.mockResolvedValue(card());
    prisma.plate.findUnique.mockResolvedValueOnce(plate({ status: "DEFECTIVE" }));
    await expect(assignPlateToCard({ plateId: "p1", cardId: "c1" }, "a")).rejects.toThrow(/defeituosa/);

    prisma.plate.findUnique.mockResolvedValueOnce(plate({ cardId: "outro" }));
    await expect(assignPlateToCard({ plateId: "p1", cardId: "c1" }, "a")).rejects.toThrow(/outro cliente/);
    expect(prisma.nFCCard.update).not.toHaveBeenCalled();
  });

  it("exige confirmação quando o dono do cartão tem painel e pode ter baixado o QR antigo", async () => {
    prisma.plate.findUnique.mockResolvedValue(plate());
    prisma.nFCCard.findUnique.mockResolvedValue(card({ company: { name: "Bar do Zé", accountType: "CUSTOMER" } }));

    const error = await assignPlateToCard({ plateId: "p1", cardId: "c1" }, "a").catch((e) => e);
    expect(error).toBeInstanceOf(PlateError);
    expect(error.code).toBe("CODE_CHANGE_CONFIRMATION");
    expect(error.status).toBe(409);
    expect(prisma.nFCCard.update).not.toHaveBeenCalled();

    await assignPlateToCard({ plateId: "p1", cardId: "c1", acceptCodeChange: true }, "a");
    expect(prisma.nFCCard.update).toHaveBeenCalledTimes(1);
  });

  it("placa de lote sob demanda já nasce com o código do cartão: não troca código, então não pede confirmação", async () => {
    prisma.plate.findUnique.mockResolvedValue(plate({ uniqueCode: "card0001" }));
    prisma.nFCCard.findUnique.mockResolvedValue(card({ company: { name: "Bar do Zé", accountType: "CUSTOMER" } }));

    const result = await assignPlateToCard({ plateId: "p1", cardId: "c1" }, "a");
    expect(result.codeChanged).toBe(false);
    expect(prisma.nFCCard.update).not.toHaveBeenCalled();
    expect(mocks.invalidateCard).not.toHaveBeenCalled();
  });

  it("atribuir de novo a mesma placa ao mesmo cartão é inofensivo (não repete nada)", async () => {
    prisma.plate.findUnique.mockResolvedValue(plate({ cardId: "c1" }));
    prisma.nFCCard.findUnique.mockResolvedValue(card());

    const result = await assignPlateToCard({ plateId: "p1", cardId: "c1" }, "a");
    expect(result.codeChanged).toBe(false);
    expect(prisma.plate.update).not.toHaveBeenCalled();
    expect(prisma.plateEvent.create).not.toHaveBeenCalled();
  });

  it("um cartão que já tem placa só aceita outra com 'trocar' — e a antiga vira defeituosa ANTES de a nova assumir o cartão", async () => {
    prisma.plate.findUnique.mockResolvedValue(plate({ id: "p2", serial: "L001-08", uniqueCode: "plate0002" }));
    prisma.nFCCard.findUnique.mockResolvedValue(card({ uniqueCode: "plate0001", plate: { id: "p1", serial: "L001-07", status: "VERIFIED" } }));

    const refused = await assignPlateToCard({ plateId: "p2", cardId: "c1" }, "a").catch((e) => e);
    expect(refused.code).toBe("CARD_HAS_PLATE");

    await assignPlateToCard({ plateId: "p2", cardId: "c1", replace: true, replaceReason: "NFC não lê" }, "a");
    const calls = prisma.plate.update.mock.calls.map((c) => c[0]);
    expect(calls[0]).toMatchObject({ where: { id: "p1" }, data: { cardId: null, status: "DEFECTIVE", defectReason: "NFC não lê" } });
    expect(calls[1]).toMatchObject({ where: { id: "p2" }, data: expect.objectContaining({ cardId: "c1" }) });
    expect(prisma.plateEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ plateId: "p1", type: "REPLACED" }) });
  });

  it("uma colisão de código no banco vira uma mensagem clara, não um erro 500", async () => {
    prisma.plate.findUnique.mockResolvedValue(plate());
    prisma.nFCCard.findUnique.mockResolvedValue(card());
    prisma.nFCCard.update.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    await expect(assignPlateToCard({ plateId: "p1", cardId: "c1" }, "a")).rejects.toThrow(/Conflito ao atribuir/);
  });
});

describe("unassignPlate", () => {
  it("devolve a placa ao estoque e dá um código NOVO ao cartão (a placa leva o dela embora)", async () => {
    prisma.plate.findUnique.mockResolvedValue({ id: "p1", serial: "L001-07", uniqueCode: "plate0001", cardId: "c1" });
    prisma.nFCCard.findMany.mockResolvedValue([]);
    prisma.plate.findMany.mockResolvedValue([]);

    await unassignPlate("p1", "a");

    const cardUpdate = prisma.nFCCard.update.mock.calls[0][0];
    expect(cardUpdate.where).toEqual({ id: "c1" });
    expect(cardUpdate.data.uniqueCode).toMatch(/^[a-z0-9]{8}$/);
    expect(cardUpdate.data.uniqueCode).not.toBe("plate0001");
    expect(prisma.plate.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { cardId: null, assignedAt: null } });
    expect(mocks.invalidateCard).toHaveBeenCalledWith("plate0001");
  });

  it("recusa devolver uma placa que não está com ninguém", async () => {
    prisma.plate.findUnique.mockResolvedValue({ id: "p1", serial: "L001-07", uniqueCode: "x", cardId: null });
    await expect(unassignPlate("p1", "a")).rejects.toThrow(/não está atribuída/);
  });
});

describe("setPlateChecks", () => {
  const base = { id: "p1", status: "IN_PRODUCTION", nfcChecked: true, qrChecked: true, serialChecked: false, batch: { id: "b1", sentAt: new Date(), receivedAt: new Date() } };

  it("marcar a terceira checagem conferida a placa e grava quando", async () => {
    prisma.plate.findUnique.mockResolvedValue(base);
    await setPlateChecks("p1", { serialChecked: true }, "a");

    expect(prisma.plate.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ status: "VERIFIED", nfcChecked: true, qrChecked: true, serialChecked: true, verifiedAt: expect.any(Date) }),
    });
    const types = prisma.plateEvent.create.mock.calls.map((c) => c[0].data.type);
    expect(types).toEqual(["CHECKED", "VERIFIED"]);
  });

  it("desmarcar uma checagem de uma placa conferida tira ela do estoque", async () => {
    prisma.plate.findUnique.mockResolvedValue({ ...base, status: "VERIFIED", serialChecked: true });
    await setPlateChecks("p1", { qrChecked: false }, "a");

    expect(prisma.plate.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ status: "IN_PRODUCTION", qrChecked: false, verifiedAt: null }),
    });
    const types = prisma.plateEvent.create.mock.calls.map((c) => c[0].data.type);
    expect(types).toEqual(["CHECKED", "UNVERIFIED"]);
  });

  it("conferir uma placa de um lote que ninguém marcou como recebido marca o lote como recebido", async () => {
    prisma.plate.findUnique.mockResolvedValue({ ...base, batch: { id: "b1", sentAt: null, receivedAt: null } });
    await setPlateChecks("p1", { nfcChecked: true }, "a");
    expect(prisma.plateBatch.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { receivedAt: expect.any(Date), sentAt: expect.any(Date) } });
  });

  it("não deixa conferir uma placa defeituosa ou anulada", async () => {
    prisma.plate.findUnique.mockResolvedValue({ ...base, status: "DEFECTIVE" });
    await expect(setPlateChecks("p1", { nfcChecked: true }, "a")).rejects.toThrow(/defeituosa ou anulada/);
    expect(prisma.plate.update).not.toHaveBeenCalled();
  });

  it("sem mudança real, não grava evento nenhum (nada de ruído na trilha)", async () => {
    prisma.plate.findUnique.mockResolvedValue(base);
    await setPlateChecks("p1", { nfcChecked: true }, "a");
    expect(prisma.plateEvent.create).not.toHaveBeenCalled();
  });
});

describe("resolvePlatePick", () => {
  it("automático: pega as placas mais antigas conferidas e sem dono; sem estoque suficiente, nada é escolhido", async () => {
    prisma.plate.findMany.mockResolvedValueOnce([{ id: "p1", serial: "L001-01" }]);
    prisma.plateModel.findUnique.mockResolvedValue({ name: "Avaliação" });
    const error = await resolvePlatePick({ mode: "AUTO", modelId: "m1" }, 2).catch((e) => e);
    expect(error.code).toBe("NOT_ENOUGH_STOCK");
    expect(error.message).toMatch(/Só há 1 placa\(s\).*"Avaliação".*precisa de 2/);

    expect(prisma.plate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { modelId: "m1", status: "VERIFIED", cardId: null }, orderBy: [{ batch: { createdAt: "asc" } }, { index: "asc" }], take: 2 })
    );
  });

  it("por número: confere quantidade, formato, existência e disponibilidade", async () => {
    await expect(resolvePlatePick({ mode: "SERIALS", serials: ["L001-01"] }, 2)).rejects.toThrow(/Informe 2/);
    await expect(resolvePlatePick({ mode: "SERIALS", serials: ["abc"] }, 1)).rejects.toThrow(/não parece um número de placa/);

    prisma.plate.findFirst.mockResolvedValueOnce(null);
    await expect(resolvePlatePick({ mode: "SERIALS", serials: ["L009-01"] }, 1)).rejects.toThrow(/Não existe a placa/);

    prisma.plate.findFirst.mockResolvedValueOnce({ id: "p1", serial: "L001-01", status: "IN_PRODUCTION", cardId: null });
    await expect(resolvePlatePick({ mode: "SERIALS", serials: ["L001-01"] }, 1)).rejects.toThrow(/ainda não foi conferida/);
  });

  it("por número: aceita 'l1-7' e procura pelo lote e posição numéricos, não pelo texto", async () => {
    prisma.plate.findFirst.mockResolvedValue({ id: "p1", serial: "L001-07", status: "VERIFIED", cardId: null });
    const picked = await resolvePlatePick({ mode: "SERIALS", serials: ["l1-7"] }, 1);
    expect(picked).toEqual([{ id: "p1", serial: "L001-07" }]);
    expect(prisma.plate.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { index: 7, batch: { code: "L001" } } }));
  });

  it("por número: recusa a mesma placa informada duas vezes", async () => {
    prisma.plate.findFirst.mockResolvedValue({ id: "p1", serial: "L001-07", status: "VERIFIED", cardId: null });
    await expect(resolvePlatePick({ mode: "SERIALS", serials: ["L001-07", "L001-7"] }, 2)).rejects.toThrow(/repetido/);
  });
});

describe("assignPlatesToOrder", () => {
  it("recusa um pedido que ainda não foi provisionado", async () => {
    prisma.storeOrder.findUnique.mockResolvedValue({ id: "o1", provisionedCardIds: [] });
    await expect(assignPlatesToOrder({ orderId: "o1", pick: { mode: "AUTO", modelId: "m1" } }, "a")).rejects.toThrow(/ainda não foi provisionado/);
  });

  it("recusa quando todos os cartões do pedido já têm placa", async () => {
    prisma.storeOrder.findUnique.mockResolvedValue({ id: "o1", provisionedCardIds: ["c1"] });
    prisma.nFCCard.findMany.mockResolvedValue([]);
    await expect(assignPlatesToOrder({ orderId: "o1", pick: { mode: "AUTO", modelId: "m1" } }, "a")).rejects.toThrow(/já têm placa/);
  });

  it("sem estoque suficiente, não atribui NENHUMA placa (tudo ou nada na escolha)", async () => {
    prisma.storeOrder.findUnique.mockResolvedValue({ id: "o1", provisionedCardIds: ["c1", "c2"] });
    prisma.nFCCard.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    prisma.plate.findMany.mockResolvedValue([{ id: "p1", serial: "L001-01" }]);
    prisma.plateModel.findUnique.mockResolvedValue({ name: "Avaliação" });

    await expect(assignPlatesToOrder({ orderId: "o1", pick: { mode: "AUTO", modelId: "m1" } }, "a")).rejects.toThrow(/Só há 1/);
    expect(prisma.nFCCard.update).not.toHaveBeenCalled();
    expect(prisma.plate.update).not.toHaveBeenCalled();
  });

  it("atribui uma placa por cartão, na ordem dos cartões", async () => {
    prisma.storeOrder.findUnique.mockResolvedValue({ id: "o1", provisionedCardIds: ["c1", "c2"] });
    prisma.nFCCard.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    prisma.plate.findMany.mockResolvedValue([
      { id: "p1", serial: "L001-01" },
      { id: "p2", serial: "L001-02" },
    ]);
    prisma.plate.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      plate({ id: where.id, serial: where.id === "p1" ? "L001-01" : "L001-02", uniqueCode: `code-${where.id}` })
    );
    prisma.nFCCard.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => card({ id: where.id, uniqueCode: `old-${where.id}` }));

    const results = await assignPlatesToOrder({ orderId: "o1", pick: { mode: "AUTO", modelId: "m1" } }, "a");
    expect(results.map((r) => r.serial)).toEqual(["L001-01", "L001-02"]);
    expect(prisma.nFCCard.update).toHaveBeenNthCalledWith(1, { where: { id: "c1" }, data: { uniqueCode: "code-p1" } });
    expect(prisma.nFCCard.update).toHaveBeenNthCalledWith(2, { where: { id: "c2" }, data: { uniqueCode: "code-p2" } });
  });
});

describe("createStockBatch", () => {
  function setupCreate(takenFirstAttempt: string[] = []) {
    prisma.plateModel.findUnique.mockResolvedValue({ id: "m1", name: "Avaliação", active: true, versions: [{ id: "v1", version: 1 }] });
    prisma.plateBatch.findMany.mockResolvedValue([{ code: "L001" }, { code: "L002" }]);
    prisma.plateBatch.create.mockImplementation(async ({ data }: { data: { code: string } }) => ({ id: "b3", ...data }));
    prisma.plate.findMany.mockImplementation(async (args: { where: { uniqueCode?: { in: string[] } }; select?: unknown }) => {
      // 1ª chamada de checagem de colisão devolve `takenFirstAttempt`; as demais, vazio.
      if (args.where.uniqueCode) return takenFirstAttempt.length ? (takenFirstAttempt.splice(0).map((uniqueCode) => ({ uniqueCode }))) : [];
      return [{ id: "px1", cardId: null }];
    });
    prisma.nFCCard.findMany.mockResolvedValue([]);
  }

  it("gera o próximo lote (L003), séries sequenciais com zero à esquerda e códigos todos diferentes", async () => {
    setupCreate();
    const batch = await createStockBatch({ modelId: "m1", quantity: 20 }, "admin@x.com");
    expect(batch.code).toBe("L003");

    const created = prisma.plate.createMany.mock.calls[0][0].data as { serial: string; uniqueCode: string; index: number; modelId: string; cardId: null }[];
    expect(created).toHaveLength(20);
    expect(created[0].serial).toBe("L003-01");
    expect(created[19].serial).toBe("L003-20");
    expect(created.every((p) => p.modelId === "m1" && p.cardId === null)).toBe(true);
    expect(new Set(created.map((p) => p.uniqueCode)).size).toBe(20);
    expect(created.every((p) => /^[a-z0-9]{8}$/.test(p.uniqueCode))).toBe(true);
  });

  it("um código que já existe (em placa ou cartão) é descartado e substituído por outro", async () => {
    setupCreate();
    let first = true;
    prisma.nFCCard.findMany.mockImplementation(async (args: { where: { uniqueCode: { in: string[] } } }) => {
      if (!first) return [];
      first = false;
      return [{ uniqueCode: args.where.uniqueCode.in[0] }];
    });
    await createStockBatch({ modelId: "m1", quantity: 5 }, "a");
    const created = prisma.plate.createMany.mock.calls[0][0].data as { uniqueCode: string }[];
    expect(created).toHaveLength(5);
    expect(new Set(created.map((p) => p.uniqueCode)).size).toBe(5);
  });

  it("recusa quantidade fora de 1–500 e modelo desativado", async () => {
    await expect(createStockBatch({ modelId: "m1", quantity: 0 }, "a")).rejects.toThrow(/entre 1 e 500/);
    await expect(createStockBatch({ modelId: "m1", quantity: 501 }, "a")).rejects.toThrow(/entre 1 e 500/);
    prisma.plateModel.findUnique.mockResolvedValue({ id: "m1", name: "X", active: false, versions: [{ id: "v1", version: 1 }] });
    await expect(createStockBatch({ modelId: "m1", quantity: 5 }, "a")).rejects.toThrow(/desativado/);
    expect(prisma.plateBatch.create).not.toHaveBeenCalled();
  });

  it("lote grande usa mais casas na série (L003-001…) para a ordem alfabética continuar certa", async () => {
    setupCreate();
    await createStockBatch({ modelId: "m1", quantity: 120 }, "a");
    const created = prisma.plate.createMany.mock.calls[0][0].data as { serial: string }[];
    expect(created[0].serial).toBe("L003-001");
    expect(created[119].serial).toBe("L003-120");
  });

  it("se dois lotes disputam o mesmo código, tenta de novo com o próximo", async () => {
    setupCreate();
    prisma.plateBatch.create.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    prisma.plateBatch.create.mockImplementationOnce(async ({ data }: { data: { code: string } }) => ({ id: "b4", ...data }));
    const batch = await createStockBatch({ modelId: "m1", quantity: 3 }, "a");
    expect(batch.id).toBe("b4");
    expect(prisma.plateBatch.create).toHaveBeenCalledTimes(2);
  });
});
