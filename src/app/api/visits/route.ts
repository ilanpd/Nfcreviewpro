import { NextRequest, NextResponse } from "next/server";
import { createVisitSchema } from "@/lib/validations/rating";
import { getActiveCardByCode } from "@/services/card.service";
import { recordVisit } from "@/services/visit.service";
import { loadReturnContext, touchReturn } from "@/services/return-offer.service";
import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE_SECONDS,
  newVisitorId,
  parseVisitorId,
} from "@/lib/return-offer/visitor-cookie";
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

    // Retorno (ADR-079): o cookie do aparelho só nasce se a empresa tem o brinde
    // de pé. Qualquer falha aqui vira "sem brinde": o caminho do cliente até o
    // destino nunca depende do Retorno.
    let returnContext = null;
    try {
      returnContext = await loadReturnContext(card.companyId);
    } catch (err) {
      console.error("[visits] falha ao carregar o Retorno", err);
    }
    const returnOn = !!returnContext?.availability.available;
    const existingVisitorId = parseVisitorId(req.cookies.get(VISITOR_COOKIE)?.value);
    const visitorId = returnOn ? (existingVisitorId ?? newVisitorId()) : null;

    const visit = await recordVisit(card.id, card.companyId, req.headers.get("user-agent"), visitorId);

    let returnView = null;
    if (returnOn && visitorId) {
      try {
        returnView = await touchReturn({
          companyId: card.companyId,
          cardId: card.id,
          visitId: visit.id,
          visitorId,
          context: returnContext,
        });
      } catch (err) {
        console.error("[visits] falha ao emitir o brinde", err);
      }
    }

    const response = NextResponse.json({ visitId: visit.id, return: returnView }, { status: 201 });
    if (returnOn && visitorId && !existingVisitorId) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
      });
    }
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
