import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getPeriodComparatives } from "@/services/analytics-engine.service";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const comparatives = await getPeriodComparatives(ctx.companyId);
    return NextResponse.json({ comparatives });
  } catch (error) {
    return handleApiError(error);
  }
}
