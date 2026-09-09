import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiV1, parsePageParams, cursorQueryArgs, buildPage, ApiV1Error } from "@/lib/api-v1";
import { PUBLIC_WEBHOOK_EVENT_MAP, PUBLIC_WEBHOOK_EVENT_TYPES, toPublicWebhookEventType } from "@/domain/api-v1/webhook-events";
import type { DomainEventType } from "@/domain/events/types";

const PUBLIC_INTERNAL_TYPES = (Object.keys(PUBLIC_WEBHOOK_EVENT_MAP) as DomainEventType[]).filter(
  (type) => PUBLIC_WEBHOOK_EVENT_MAP[type] !== null
);

/**
 * Somente leitura, sempre escopado a `apiKey.companyId` (nunca aceita um
 * `companyId` arbitrário no filtro — ao contrário de `replay.service.ts`,
 * que é uma ferramenta interna de `/dev/ceo`). Só devolve eventos com um
 * nome PÚBLICO estável (ver `domain/api-v1/webhook-events.ts`) — os mesmos
 * 8 de 10 eventos que os webhooks conseguem assinar; os outros 2 ainda são
 * um detalhe interno do Event Bus, não um contrato público desta fase.
 */
export const GET = withApiV1(
  async (req, { apiKey }) => {
    const params = req.nextUrl.searchParams;
    const page = parsePageParams(params);

    const typeParam = params.get("type");
    if (typeParam && !PUBLIC_WEBHOOK_EVENT_TYPES.includes(typeParam)) {
      throw new ApiV1Error("validation_error", `"type" deve ser um de: ${PUBLIC_WEBHOOK_EVENT_TYPES.join(", ")}.`);
    }
    const internalTypes = typeParam
      ? PUBLIC_INTERNAL_TYPES.filter((t) => PUBLIC_WEBHOOK_EVENT_MAP[t] === typeParam)
      : PUBLIC_INTERNAL_TYPES;

    const since = params.get("since") ? new Date(params.get("since")!) : undefined;
    const until = params.get("until") ? new Date(params.get("until")!) : undefined;

    const rows = await prisma.eventLog.findMany({
      where: {
        companyId: apiKey.companyId,
        type: { in: internalTypes },
        ...(since || until ? { createdAt: { ...(since ? { gte: since } : {}), ...(until ? { lte: until } : {}) } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorQueryArgs(page),
    });

    const { data, has_more, next_cursor } = buildPage(rows, page.limit);
    return NextResponse.json({
      data: data.map((row) => ({
        id: row.id,
        type: toPublicWebhookEventType(row.type as DomainEventType),
        payload: row.payload,
        created_at: row.createdAt,
      })),
      has_more,
      next_cursor,
    });
  },
  { scopes: ["events:read"] }
);
