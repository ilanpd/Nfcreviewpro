import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { createCampaignSchema } from "@/lib/validations/campaign";
import { createCampaign, listCampaigns } from "@/services/campaign.service";
import { recordAudit } from "@/services/audit.service";
import { publishEvent } from "@/lib/event-bus";
import { handleApiError } from "@/lib/api-error";
import type { CampaignListFilters } from "@/repositories/campaign.repository";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const params = req.nextUrl.searchParams;

    const filters: CampaignListFilters = {
      search: params.get("search") ?? undefined,
      status: (params.get("status") as CampaignListFilters["status"]) ?? undefined,
      type: (params.get("type") as CampaignListFilters["type"]) ?? undefined,
      sort: (params.get("sort") as CampaignListFilters["sort"]) ?? undefined,
    };

    const campaigns = await listCampaigns(ctx.companyId, filters);
    return NextResponse.json({ campaigns });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:write");
    const input = createCampaignSchema.parse(await req.json());
    const campaign = await createCampaign(ctx.companyId, input);
    await recordAudit(ctx, "CAMPAIGN_CREATED", { targetId: campaign.id, metadata: { name: campaign.name } });
    await publishEvent("CampanhaCriada", { campaignId: campaign.id, name: campaign.name, type: campaign.type }, { companyId: ctx.companyId });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
