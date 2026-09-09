import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiV1, notFoundIfMissing } from "@/lib/api-v1";
import { setFeedbackResolved } from "@/services/feedback.service";

const updateFeedbackSchema = z.object({ resolved: z.boolean() });

export const PATCH = withApiV1<{ id: string }>(
  async (req, { params, apiKey }) => {
    const { resolved } = updateFeedbackSchema.parse(await req.json());
    const feedback = await notFoundIfMissing(() => setFeedbackResolved(apiKey.companyId, params.id, resolved));
    return NextResponse.json(feedback);
  },
  { scopes: ["feedback:write"] }
);
