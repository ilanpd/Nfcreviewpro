import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth";
import { setFeedbackResolved } from "@/services/feedback.service";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({ resolved: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const { resolved } = bodySchema.parse(await req.json());
    const feedback = await setFeedbackResolved(ctx.companyId, id, resolved);
    return NextResponse.json({ feedback });
  } catch (error) {
    return handleApiError(error);
  }
}
