import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { batchCreateSchema } from "@/lib/validations/plates";
import { createOrdersBatch, createStockBatch, listBatches } from "@/services/plates.service";

export async function GET() {
  try {
    await requirePlateAdmin();
    return NextResponse.json({ batches: await listBatches() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePlateAdmin();
    const input = batchCreateSchema.parse(await req.json());
    const batch = input.mode === "STOCK" ? await createStockBatch(input, actor) : await createOrdersBatch(input, actor);
    return NextResponse.json({ batch: { id: batch.id, code: batch.code, quantity: batch.quantity } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
