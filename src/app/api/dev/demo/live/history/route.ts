import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listRecentEvents } from "@/services/live.service";
import { devToolsEnabled } from "@/lib/dev/gate";

const MAX_MINUTES = 24 * 60;
const PLAYBACK_LIMIT = 300;

/** Equivalente de `/api/live/history` para o Command Center — ver ADR-027. */
export async function GET(req: NextRequest) {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada — rode o seed" }, { status: 404 });

  const minutes = Math.min(MAX_MINUTES, Math.max(1, Number(req.nextUrl.searchParams.get("minutes") ?? "30")));
  const since = new Date(Date.now() - minutes * 60_000);
  const events = await listRecentEvents(company.id, since, PLAYBACK_LIMIT);
  return NextResponse.json({ events: [...events].reverse() });
}
