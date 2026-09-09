import { NextResponse } from "next/server";
import { withApiV1, notFoundIfMissing } from "@/lib/api-v1";
import { replayWebhookDelivery } from "@/services/webhook-endpoint.service";

export const POST = withApiV1<{ id: string; deliveryId: string }>(
  async (_req, { params, apiKey }) => {
    const delivery = await notFoundIfMissing(() => replayWebhookDelivery(apiKey.companyId, params.id, params.deliveryId));
    return NextResponse.json(delivery);
  },
  { scopes: ["webhooks:manage"] }
);
