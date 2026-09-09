import { NextRequest, NextResponse } from "next/server";
import { createFeedbackSchema } from "@/lib/validations/feedback";
import { createFeedback, listFeedback } from "@/services/feedback.service";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { requireAuthContext } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

// Public: submitted from the /feedback screen after a 1-3 star rating.
export async function POST(req: NextRequest) {
  try {
    const ip = await getRequestIp();
    const { success } = await rateLimit("feedback", ip);
    if (!success) throw new Error("RATE_LIMITED");

    const input = createFeedbackSchema.parse(await req.json());
    const { feedback, whatsappUrl } = await createFeedback(input);
    return NextResponse.json({ feedback, whatsappUrl }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// Dashboard: list this company's private feedback, optionally filtered by resolution status.
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const resolvedParam = req.nextUrl.searchParams.get("resolved");
    const resolved = resolvedParam === null ? undefined : resolvedParam === "true";
    const feedback = await listFeedback(ctx.companyId, resolved);
    return NextResponse.json({ feedback });
  } catch (error) {
    return handleApiError(error);
  }
}
