import { NextResponse } from "next/server";
import { withApiV1, notFoundIfMissing, parsePageParams, buildPage } from "@/lib/api-v1";
import { listWebhookDeliveries } from "@/services/webhook-endpoint.service";

export const GET = withApiV1<{ id: string }>(
  async (req, { params, apiKey }) => {
    const page = parsePageParams(req.nextUrl.searchParams);
    const rows = await notFoundIfMissing(() => listWebhookDeliveries(apiKey.companyId, params.id, page.cursor, page.limit));
    return NextResponse.json(buildPage(rows, page.limit));
  },
  { scopes: ["webhooks:manage"] }
);
