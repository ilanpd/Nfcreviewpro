import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getSnapshotAt, getWindowSummary } from "@/services/time-machine.service";
import { devToolsEnabled } from "@/lib/dev/gate";

const MAX_WINDOW_MINUTES = 180;

/** Equivalente de `/api/table-map/time-machine` para o Command Center — ver ADR-027. */
export async function GET(req: NextRequest) {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada — rode o seed" }, { status: 404 });

  const atParam = req.nextUrl.searchParams.get("at");
  const at = atParam ? new Date(atParam) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Parâmetro 'at' inválido" }, { status: 400 });
  }

  const windowMinutes = Math.min(MAX_WINDOW_MINUTES, Math.max(1, Number(req.nextUrl.searchParams.get("windowMinutes") ?? "30")));
  const windowStart = new Date(at.getTime() - windowMinutes * 60_000);

  const [snapshot, summary] = await Promise.all([
    getSnapshotAt(company.id, at),
    getWindowSummary(company.id, windowStart, at),
  ]);

  return NextResponse.json({ snapshot, summary });
}
