import { NextResponse } from "next/server";
import { withApiV1, notFoundIfMissing } from "@/lib/api-v1";
import { getCampaign, updateCampaign, deleteCampaign } from "@/services/campaign.service";
import { updateCampaignSchema } from "@/lib/validations/campaign";

export const GET = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    const campaign = await notFoundIfMissing(() => getCampaign(apiKey.companyId, params.id));
    return NextResponse.json(campaign);
  },
  { scopes: ["campaigns:read"] }
);

/**
 * `nfc.campaigns.activate(id)`/`.pause(id)` do SDK (ver packages/sdk) são
 * só açúcar sintático para `PATCH { status: "ACTIVE" | "PAUSED" }` — o
 * mesmo campo que a atualização completa já aceita, nunca uma rota
 * separada para a mesma mudança de estado (ver Platform First Review:
 * "sem exceções arbitrárias" também vale para não multiplicar endpoints
 * que fazem a mesma coisa).
 */
export const PATCH = withApiV1<{ id: string }>(
  async (req, { params, apiKey }) => {
    const input = updateCampaignSchema.parse(await req.json());
    const campaign = await notFoundIfMissing(() => updateCampaign(apiKey.companyId, params.id, input));
    return NextResponse.json(campaign);
  },
  { scopes: ["campaigns:write"] }
);

export const DELETE = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    await notFoundIfMissing(() => deleteCampaign(apiKey.companyId, params.id));
    return NextResponse.json({ id: params.id, deleted: true });
  },
  { scopes: ["campaigns:write"] }
);
