import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const findFirst = vi.fn();
const createZone = vi.fn(async (companyId: string, name: string, branchId?: string | null) => ({ id: "z1", companyId, name, branchId: branchId ?? null }));
vi.mock("@/lib/prisma", () => ({ prisma: { branch: { findFirst: (...a: unknown[]) => findFirst(...a) } } }));
vi.mock("@/repositories/zone.repository", () => ({
  createZone: (...a: [string, string, (string | null)?]) => createZone(...a),
  findZones: vi.fn(),
  findZoneById: vi.fn(),
  updateZone: vi.fn(),
  deleteZone: vi.fn(),
}));
vi.mock("@/lib/resolution-engine/cache", () => ({ invalidateCompanyCampaigns: vi.fn() }));

import { ForbiddenError } from "@/lib/auth";
import { createZone as createZoneService } from "./zone.service";

beforeEach(() => {
  findFirst.mockReset();
  createZone.mockClear();
});

describe("createZone: a unidade informada tem de ser da mesma empresa", () => {
  it("recusa um branchId de OUTRA empresa e não grava nada", async () => {
    findFirst.mockResolvedValue(null); // a busca por id + companyId não acha a unidade alheia
    await expect(createZoneService("empresa-a", "Varanda", "filial-da-empresa-b")).rejects.toBeInstanceOf(ForbiddenError);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "filial-da-empresa-b", companyId: "empresa-a" }, select: { id: true } });
    expect(createZone).not.toHaveBeenCalled();
  });

  it("aceita uma unidade da própria empresa", async () => {
    findFirst.mockResolvedValue({ id: "filial-a" });
    await expect(createZoneService("empresa-a", "Varanda", "filial-a")).resolves.toMatchObject({ branchId: "filial-a" });
    expect(createZone).toHaveBeenCalledWith("empresa-a", "Varanda", "filial-a");
  });

  it("zona sem unidade continua permitida (e nem consulta o banco)", async () => {
    await expect(createZoneService("empresa-a", "Salão")).resolves.toMatchObject({ branchId: null });
    await createZoneService("empresa-a", "Salão", null);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
