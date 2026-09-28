import { describe, expect, it, vi } from "vitest";

/**
 * A fonte única do que conta como "conversão" (auditoria de 28/09/2026— ver o
 * comentário grande em conversion.ts). O que está sob teste aqui é só a forma
 * da consulta: `primaryClickedAt` OU o sinal legado, nunca duplicando visitas
 * (é um único OR, não uma soma de duas contagens) e nunca voltando à consulta
 * antiga (`ratingEvent.count` sozinho) que zerava para sempre desde a ADR-080.
 */
vi.mock("server-only", () => ({}));
const { count, findMany } = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { visit: { count, findMany } } }));

import { CONVERTED_VISIT_WHERE, countConvertedVisits, countConvertedVisitsTotal, findConvertedVisits } from "./conversion";

const since = new Date("2026-09-01T00:00:00Z");
const until = new Date("2026-09-08T00:00:00Z");

describe("lib/analytics/conversion", () => {
  it("CONVERTED_VISIT_WHERE é um OR entre o sinal novo e o legado, nunca um E", () => {
    expect(CONVERTED_VISIT_WHERE).toEqual({
      OR: [{ primaryClickedAt: { not: null } }, { ratingEvent: { redirectedGoogle: true } }],
    });
  });

  it("countConvertedVisits: sem `until`, filtra só por `gte` e aplica o OR", async () => {
    count.mockResolvedValue(3);
    const result = await countConvertedVisits("co_1", since);
    expect(result).toBe(3);
    expect(count).toHaveBeenCalledWith({ where: { companyId: "co_1", createdAt: { gte: since }, ...CONVERTED_VISIT_WHERE } });
  });

  it("countConvertedVisits: com `until`, vira uma janela [since, until) — nunca inclui o instante final duas vezes num comparativo de períodos", async () => {
    count.mockResolvedValue(1);
    await countConvertedVisits("co_1", since, until);
    expect(count).toHaveBeenCalledWith({ where: { companyId: "co_1", createdAt: { gte: since, lt: until }, ...CONVERTED_VISIT_WHERE } });
  });

  it("countConvertedVisitsTotal: histórico completo, sem nenhum recorte de data", async () => {
    count.mockResolvedValue(42);
    const result = await countConvertedVisitsTotal("co_1");
    expect(result).toBe(42);
    expect(count).toHaveBeenCalledWith({ where: { companyId: "co_1", ...CONVERTED_VISIT_WHERE } });
  });

  it("findConvertedVisits: devolve cardId+createdAt, sem filtro de cartão quando nenhum é passado", async () => {
    findMany.mockResolvedValue([{ cardId: "card_1", createdAt: since }]);
    const rows = await findConvertedVisits("co_1", since);
    expect(rows).toEqual([{ cardId: "card_1", createdAt: since }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { companyId: "co_1", createdAt: { gte: since }, ...CONVERTED_VISIT_WHERE },
      select: { cardId: true, createdAt: true },
    });
  });

  it("findConvertedVisits: cardId restringe a um cartão específico (peak-hour de um card só)", async () => {
    findMany.mockResolvedValue([]);
    await findConvertedVisits("co_1", since, "card_9");
    expect(findMany.mock.calls.at(-1)![0].where).toMatchObject({ cardId: "card_9" });
  });

  it("findConvertedVisits: com `until`, usa janela inclusiva nos dois extremos (Time Machine)", async () => {
    findMany.mockResolvedValue([]);
    await findConvertedVisits("co_1", since, undefined, until);
    expect(findMany.mock.calls.at(-1)![0].where.createdAt).toEqual({ gte: since, lte: until });
  });
});
