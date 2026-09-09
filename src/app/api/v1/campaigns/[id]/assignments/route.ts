import { NextResponse } from "next/server";
import { withApiV1, buildSyntheticAuthContext } from "@/lib/api-v1";
import { listAssignments, assignCampaign } from "@/services/campaign.service";
import { assignCampaignSchema } from "@/lib/validations/campaign";

/** Não paginado por cursor: o número de atribuições de UMA campanha é
 * pequeno por natureza (uma por unidade/zona/cartão relevante, tipicamente
 * dezenas, nunca milhares) — cursor pagination aqui seria complexidade sem
 * benefício real. */
export const GET = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    const assignments = await listAssignments(apiKey.companyId, params.id);
    return NextResponse.json({ data: assignments });
  },
  { scopes: ["campaigns:read"] }
);

export const POST = withApiV1<{ id: string }>(
  async (req, { params, apiKey }) => {
    const input = assignCampaignSchema.parse(await req.json());
    const ctx = await buildSyntheticAuthContext(apiKey.companyId);
    const assignment = await assignCampaign(ctx, params.id, input);
    return NextResponse.json(assignment, { status: 201 });
  },
  { scopes: ["campaigns:write"] }
);
