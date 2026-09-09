import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getRecommendationDetail } from "@/services/recommendation-engine.service";
import { handleApiError } from "@/lib/api-error";

// Explainability Panel (Fase 11) — o detalhe completo de UMA recomendação:
// evidência, comparação histórica, confiança fatorada, regra disparada.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const recommendation = await getRecommendationDetail(ctx.companyId, id);
    return NextResponse.json({ recommendation });
  } catch (error) {
    return handleApiError(error);
  }
}
