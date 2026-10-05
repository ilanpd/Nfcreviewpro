import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { listStockLots } from "@/services/plates.service";

/** Modelos ativos e LOTES com placas conferidas e sem dono (e quantas) — para os seletores de venda e de atribuição. */
export async function GET() {
  try {
    await requirePlateAdmin();
    const [models, counts, lots] = await Promise.all([
      prisma.plateModel.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.plate.groupBy({ by: ["modelId"], where: { status: "VERIFIED", cardId: null }, _count: { _all: true } }),
      listStockLots(),
    ]);
    const inStock = Object.fromEntries(counts.map((c) => [c.modelId, c._count._all]));
    return NextResponse.json({ models: models.map((m) => ({ ...m, inStock: inStock[m.id] ?? 0 })), lots });
  } catch (error) {
    return handleApiError(error);
  }
}
