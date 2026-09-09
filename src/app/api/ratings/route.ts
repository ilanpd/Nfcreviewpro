import { NextRequest, NextResponse } from "next/server";
import { createRatingSchema } from "@/lib/validations/rating";
import { createRating } from "@/services/rating.service";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const ip = await getRequestIp();
    const { success } = await rateLimit("rating", ip);
    if (!success) throw new Error("RATE_LIMITED");

    const { visitId, stars } = createRatingSchema.parse(await req.json());
    const result = await createRating(visitId, stars);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
