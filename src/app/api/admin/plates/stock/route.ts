import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";

/** Modelos ativos e quantas placas conferidas e sem dono cada um tem — para os seletores de venda. */
export async function GET() {
  try {
    await requirePlateAdmin();
    const [models, counts] = await Promise.all([
      prisma.plateModel.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.plate.groupBy({ by: ["modelId"], where: { status: "VERIFIED", cardId: null }, _count: { _all: true } }),
    ]);
    const inStock = Object.fromEntries(counts.map((c) => [c.modelId, c._count._all]));
    return NextResponse.json({ models: models.map((m) => ({ ...m, inStock: inStock[m.id] ?? 0 })) });
  } catch (error) {
    return handleApiError(error);
  }
}
