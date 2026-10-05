import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { plateModelCreateSchema } from "@/lib/validations/plates";
import { createPlateModel, listPlateModels } from "@/services/plates.service";

export async function GET() {
  try {
    await requirePlateAdmin();
    return NextResponse.json({ models: await listPlateModels() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePlateAdmin();
    const input = plateModelCreateSchema.parse(await req.json());
    return NextResponse.json({ model: await createPlateModel(input, actor) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
