import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { plateAssignSchema } from "@/lib/validations/plates";
import { assignPlateToCard, unassignPlate } from "@/services/plates.service";

/** Liga a placa a um cartão (ou troca a placa de um cartão, com `replace`). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePlateAdmin();
    const { id } = await params;
    const input = plateAssignSchema.parse(await req.json());
    const result = await assignPlateToCard({ plateId: id, ...input }, actor);
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Devolve a placa ao estoque; o cartão recebe um código novo. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePlateAdmin();
    const { id } = await params;
    await unassignPlate(id, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
