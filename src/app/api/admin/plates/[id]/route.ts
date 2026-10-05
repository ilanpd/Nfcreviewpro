import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { plateActionSchema } from "@/lib/validations/plates";
import { getPlateDetail, markPlateDefective, restorePlate, setPlateChecks, voidPlate } from "@/services/plates.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlateAdmin();
    const { id } = await params;
    const detail = await getPlateDetail(id);
    if (!detail) return NextResponse.json({ error: "Placa não encontrada" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Conferir, marcar defeituosa, anular ou restaurar — cada ação grava um evento na trilha da placa. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePlateAdmin();
    const { id } = await params;
    const input = plateActionSchema.parse(await req.json());
    switch (input.action) {
      case "check":
        await setPlateChecks(id, { nfcChecked: input.nfcChecked, qrChecked: input.qrChecked, serialChecked: input.serialChecked }, actor);
        break;
      case "defective":
        await markPlateDefective(id, input.reason, actor);
        break;
      case "void":
        await voidPlate(id, input.reason, actor);
        break;
      case "restore":
        await restorePlate(id, actor);
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
