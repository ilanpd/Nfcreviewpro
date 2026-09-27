import { NextRequest } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { listGlobalRecentEvents } from "@/services/live.service";
import { incrementSseConnections, decrementSseConnections } from "@/lib/observability/sse-metrics";

/**
 * Fase 19.2 — Timeline Viva do Centro de Operações. Mesmo contrato SSE de
 * `/api/live/stream` (polling de 2s, ADR-025), trocando só a fonte de
 * dado (`listGlobalRecentEvents`, sem filtro de empresa) e o gate
 * (`isSuperAdmin()` em vez de `requireAuthContext()`) — nunca uma segunda
 * implementação do protocolo de reconexão/heartbeat.
 */
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 15000;
const MAX_CONNECTION_MS = 50_000;

export async function GET(req: NextRequest) {
  if (!(await isSuperAdmin())) return new Response("Unauthorized", { status: 401 });

  const sinceParam = req.nextUrl.searchParams.get("since");
  let since = sinceParam ? new Date(sinceParam) : new Date();
  if (Number.isNaN(since.getTime())) since = new Date();

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      let lastHeartbeat = Date.now();

      function send(event: string, data: unknown) {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      send("connected", { since: since.toISOString() });
      incrementSseConnections();

      while (!closed && Date.now() - startedAt < MAX_CONNECTION_MS) {
        try {
          const events = await listGlobalRecentEvents(since);
          if (events.length > 0) {
            since = new Date(Math.max(...events.map((e) => e.createdAt)) + 1);
            for (const event of [...events].reverse()) send("live-event", event);
          }
        } catch (err) {
          console.error("[admin/live/stream] polling failed", err);
        }

        if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
          send("heartbeat", { at: new Date().toISOString() });
          lastHeartbeat = Date.now();
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!closed) {
        send("reconnect", { since: since.toISOString() });
        controller.close();
        decrementSseConnections();
      }
    },
    cancel() {
      closed = true;
      decrementSseConnections();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
