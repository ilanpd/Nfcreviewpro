import { NextResponse } from "next/server";
import { withApiV1, ApiV1Error } from "@/lib/api-v1";
import { getRanking } from "@/services/ranking-engine.service";
import type { RankingType } from "@/domain/analytics/types";

const VALID_TYPES: RankingType[] = ["CAMPAIGN", "ZONE", "CARD", "EMPLOYEE", "HOUR", "DAY_OF_WEEK"];

export const GET = withApiV1(
  async (req, { apiKey }) => {
    const type = req.nextUrl.searchParams.get("type") as RankingType | null;
    if (!type || !VALID_TYPES.includes(type)) {
      throw new ApiV1Error("validation_error", `"type" deve ser um de: ${VALID_TYPES.join(", ")}.`);
    }
    const daysParam = req.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : 30;
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new ApiV1Error("validation_error", '"days" deve ser um número inteiro entre 1 e 365.');
    }
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 10;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ApiV1Error("validation_error", '"limit" deve ser um número inteiro entre 1 e 100.');
    }

    const ranking = await getRanking(apiKey.companyId, type, days, limit);
    return NextResponse.json({ data: ranking });
  },
  { scopes: ["analytics:read"] }
);
