import { NextRequest, NextResponse } from "next/server";
import { createVisitSchema } from "@/lib/validations/rating";
import { getActiveCardByCode } from "@/services/card.service";
import { recordVisit } from "@/services/visit.service";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const ip = await getRequestIp();
    const { success } = await rateLimit("publicCard", ip);
    if (!success) throw new Error("RATE_LIMITED");

    const { code } = createVisitSchema.parse(await req.json());

    const card = await getActiveCardByCode(code);
    if (!card) {
      return NextResponse.json({ error: "Cartão não encontrado ou inativo" }, { status: 404 });
    }

    const visit = await recordVisit(card.id, card.companyId, req.headers.get("user-agent"));
    return NextResponse.json({ visitId: visit.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
