import { NextRequest } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listRecentEvents } from "@/services/live.service";
import { incrementSseConnections, decrementSseConnections } from "@/lib/observability/sse-metrics";
import { devToolsEnabled } from "@/lib/dev/gate";

/**
 * Equivalente de `/api/live/stream` para o Command Center de demonstração em
 * `/dev/ceo` — mesma lógica de polling/SSE, mesmo `listRecentEvents`, só
 * trocando `requireAuthContext()` por uma empresa fixa (Bella Vista), porque
 * essa tela não tem uma sessão de verdade por trás. Nunca existe fora de
 * desenvolvimento/preview. Ver ADR-027 em DECISOES_DE_ARQUITETURA.md.
 */
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 15000;
const MAX_CONNECTION_MS = 50_000;

export async function GET(req: NextRequest) {
  if (!devToolsEnabled()) return new Response("Not found", { status: 404 });

  const company = await getDemoCompany();
  if (!company) return new Response("Empresa de demonstração não encontrada — rode o seed", { status: 404 });

  const companyId = company.id;
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
          const events = await listRecentEvents(companyId, since);
          if (events.length > 0) {
            since = new Date(Math.max(...events.map((e) => e.createdAt)) + 1);
            for (const event of [...events].reverse()) send("live-event", event);
          }
        } catch (err) {
          console.error("[dev/demo/live/stream] polling failed", err);
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
