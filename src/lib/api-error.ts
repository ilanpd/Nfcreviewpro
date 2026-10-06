import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, ForbiddenError } from "./auth";
import { CampaignConflictError } from "@/services/campaign.service";
import { StoreOrderProvisionError } from "@/services/store-order.service";
import { ReturnOfferError } from "@/services/return-offer.service";
import { FeedbackError } from "@/services/feedback.service";
import { PlateError } from "@/services/plates.service";
import { CardUrlNotReadyError } from "@/lib/card-url";
import { reportServerError } from "@/lib/observability/report-error";

/** Central place to turn a thrown error into a consistent JSON response for API routes. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Dados inválidos", issues: error.flatten() }, { status: 400 });
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof CampaignConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof StoreOrderProvisionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof FeedbackError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ReturnOfferError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof PlateError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof CardUrlNotReadyError) {
    return NextResponse.json({ error: error.message, code: "CARD_URL_NOT_READY" }, { status: 503 });
  }
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return NextResponse.json({ error: "Muitas requisições, tente novamente em instantes." }, { status: 429 });
  }

  console.error(error);
  // Erro inesperado = 500: sem isto o Sentry nunca saberia (a rota captura o erro e responde normalmente).
  reportServerError(error, { module: "api" });
  return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
}
