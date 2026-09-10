import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listRecentEventLogs } from "@/services/replay.service";
import type { DomainEventType } from "@/domain/events/types";
import { devToolsEnabled } from "@/lib/dev/gate";

/** Event Explorer (Fase 12) — lista, mais recente primeiro, do MESMO `EventLog` do Event Bus (Fase 8). */
export async function GET(req: NextRequest) {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada" }, { status: 404 });

  const type = req.nextUrl.searchParams.get("type") as DomainEventType | null;
  const events = await listRecentEventLogs({ companyId: company.id, type: type ?? undefined, limit: 50 });
  return NextResponse.json({ events });
}
