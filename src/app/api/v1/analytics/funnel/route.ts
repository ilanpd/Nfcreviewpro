import { NextResponse } from "next/server";
import { withApiV1, ApiV1Error } from "@/lib/api-v1";
import { getFunnel } from "@/services/analytics-engine.service";

export const GET = withApiV1(
  async (req, { apiKey }) => {
    const daysParam = req.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : 30;
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new ApiV1Error("validation_error", '"days" deve ser um número inteiro entre 1 e 365.');
    }
    const funnel = await getFunnel(apiKey.companyId, days);
    return NextResponse.json({ data: funnel });
  },
  { scopes: ["analytics:read"] }
);
