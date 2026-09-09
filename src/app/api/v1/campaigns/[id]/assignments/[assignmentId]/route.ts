import { NextResponse } from "next/server";
import { withApiV1, buildSyntheticAuthContext, notFoundIfMissing } from "@/lib/api-v1";
import { unassignCampaign } from "@/services/campaign.service";

export const DELETE = withApiV1<{ id: string; assignmentId: string }>(
  async (_req, { params, apiKey }) => {
    const ctx = await buildSyntheticAuthContext(apiKey.companyId);
    await notFoundIfMissing(() => unassignCampaign(ctx, params.assignmentId));
    return NextResponse.json({ id: params.assignmentId, deleted: true });
  },
  { scopes: ["campaigns:write"] }
);
