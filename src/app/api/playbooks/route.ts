import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { listRecommendations } from "@/services/recommendation-engine.service";
import { handleApiError } from "@/lib/api-error";
import type { RecommendationStatus } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const status = req.nextUrl.searchParams.get("status") as RecommendationStatus | null;
    const recommendations = await listRecommendations(ctx.companyId, status ?? undefined);
    return NextResponse.json({ recommendations });
  } catch (error) {
    return handleApiError(error);
  }
}
