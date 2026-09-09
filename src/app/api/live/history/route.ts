import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { listRecentEvents } from "@/services/live.service";
import { handleApiError } from "@/lib/api-error";

const MAX_MINUTES = 24 * 60;
const PLAYBACK_LIMIT = 300;

/**
 * Playback Mode (Fase 6): reaproveita `listRecentEvents` — o mesmo agregador
 * que alimenta o Live Mode — só que numa janela mais larga (até 24h) e em
 * ordem cronológica (mais antigo primeiro), para o cliente reproduzir os
 * eventos na ordem em que aconteceram.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const minutes = Math.min(MAX_MINUTES, Math.max(1, Number(req.nextUrl.searchParams.get("minutes") ?? "30")));
    const since = new Date(Date.now() - minutes * 60_000);
    const events = await listRecentEvents(ctx.companyId, since, PLAYBACK_LIMIT);
    return NextResponse.json({ events: [...events].reverse() });
  } catch (error) {
    return handleApiError(error);
  }
}
