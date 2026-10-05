import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { plateModelMetaSchema } from "@/lib/validations/plates";
import { getPlateModel, updatePlateModelMeta } from "@/services/plates.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlateAdmin();
    const { id } = await params;
    const model = await getPlateModel(id);
    if (!model) return NextResponse.json({ error: "Modelo não encontrado" }, { status: 404 });
    return NextResponse.json({ model });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlateAdmin();
    const { id } = await params;
    const input = plateModelMetaSchema.parse(await req.json());
    return NextResponse.json({ model: await updatePlateModelMeta(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
