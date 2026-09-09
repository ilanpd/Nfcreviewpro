import { NextRequest } from "next/server";
import { requireAuthContext, UnauthorizedError } from "@/lib/auth";
import { listRecentEvents } from "@/services/live.service";
import { incrementSseConnections, decrementSseConnections } from "@/lib/observability/sse-metrics";

// SSE precisa do runtime Node (o adapter do Prisma 7 exige Node; Edge não
// serve aqui de qualquer forma). Ver ADR-025 para por que este é SSE com
// polling do banco, não WebSocket real — não há servidor persistente
// separado nesta fase, e uma function serverless não sustenta uma conexão
// WebSocket verdadeira sem uma peça de infraestrutura à parte.
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 15000;
// Fecha a conexão de forma proativa e limpa antes de qualquer timeout de
// plataforma (Vercel corta functions serverless após um tempo configurado,
// tipicamente curto no plano Hobby) — o EventSource do navegador reabre
// sozinho, então isso é invisível para quem está olhando a tela, só um
// detalhe de infraestrutura.
const MAX_CONNECTION_MS = 50_000;

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch (error) {
    if (error instanceof UnauthorizedError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }

  const companyId = ctx.companyId;
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

      // Confirma a conexão imediatamente — o cliente usa isto para sair do
      // estado "connecting" sem esperar o primeiro evento real, que pode
      // nunca vir se o salão estiver parado.
      send("connected", { since: since.toISOString() });
      incrementSseConnections();

      while (!closed && Date.now() - startedAt < MAX_CONNECTION_MS) {
        try {
          const events = await listRecentEvents(companyId, since);
          if (events.length > 0) {
            since = new Date(Math.max(...events.map((e) => e.createdAt)) + 1);
            // Mais antigos primeiro, para o feed do cliente anexar em ordem.
            for (const event of [...events].reverse()) send("live-event", event);
          }
        } catch (err) {
          console.error("[live/stream] polling failed", err);
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
