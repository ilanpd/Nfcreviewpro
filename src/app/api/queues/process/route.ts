import { NextRequest, NextResponse } from "next/server";
import { drainQueuesForDuration } from "@/lib/workers/drain";

// SSE já usa runtime nodejs pelo mesmo motivo (ver ADR-025) — o Worker
// Engine também precisa do runtime Node completo (BullMQ/ioredis não
// funcionam no Edge).
export const runtime = "nodejs";
export const maxDuration = 60;

const DRAIN_DURATION_MS = 45_000; // abaixo do limite de 60s da function, com margem

/**
 * Worker Engine (Fase 8) — o "coração" do processamento de filas em
 * produção serverless: o Vercel Cron aciona esta rota periodicamente (ex.:
 * a cada minuto — configurar em `vercel.json`), e por até
 * `DRAIN_DURATION_MS` um `Worker` de vida curta consome o que houver
 * disponível nas 6 filas, então se fecha — o mesmo padrão de auto-
 * encerramento do SSE (ADR-025), aplicado a filas. Protegida por
 * `CRON_SECRET` para nunca ser acionável publicamente (processar filas sob
 * demanda de qualquer visitante seria uma superfície de negação de
 * serviço). Ver ADR-033.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado — rota desabilitada" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await drainQueuesForDuration(DRAIN_DURATION_MS);
  return NextResponse.json(result);
}
