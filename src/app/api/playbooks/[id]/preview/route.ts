import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getExecutionPreview } from "@/services/recommendation-engine.service";
import { handleApiError } from "@/lib/api-error";

// One-Tap Execution (Fase 11) — "Preview Inteligente" antes de aplicar,
// reaproveitando o mesmo Ghost Mode do Mapa de Mesas (ver execution-engine.service.ts).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const preview = await getExecutionPreview(ctx.companyId, id);
    return NextResponse.json({ preview });
  } catch (error) {
    return handleApiError(error);
  }
}
