import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, ForbiddenError } from "./auth";
import { CampaignConflictError } from "@/services/campaign.service";

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
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return NextResponse.json({ error: "Muitas requisições, tente novamente em instantes." }, { status: 429 });
  }

  console.error(error);
  return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
}
