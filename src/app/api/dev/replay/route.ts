import { NextRequest, NextResponse } from "next/server";
import { reconstructSequence, replayToQueues } from "@/services/replay.service";
import { handleApiError } from "@/lib/api-error";
import type { DomainEventType } from "@/domain/events/types";

function parseFilter(params: URLSearchParams) {
  const since = params.get("since");
  const until = params.get("until");
  return {
    id: params.get("id") || undefined,
    type: (params.get("type") as DomainEventType) || undefined,
    correlationId: params.get("correlationId") || undefined,
    companyId: params.get("companyId") || undefined,
    since: since ? new Date(since) : undefined,
    until: until ? new Date(until) : undefined,
    limit: params.get("limit") ? Number(params.get("limit")) : undefined,
  };
}

/** Somente leitura — reconstrói a sequência de eventos gravados. */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const events = await reconstructSequence(parseFilter(req.nextUrl.searchParams));
    return NextResponse.json({ events });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Com efeito colateral — reenfileira os eventos encontrados para seus consumidores. */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({}));
    const result = await replayToQueues({
      id: body.id,
      type: body.type,
      correlationId: body.correlationId,
      companyId: body.companyId,
      since: body.since ? new Date(body.since) : undefined,
      until: body.until ? new Date(body.until) : undefined,
      limit: body.limit,
    });
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
