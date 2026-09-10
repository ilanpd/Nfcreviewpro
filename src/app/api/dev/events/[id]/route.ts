import { NextResponse } from "next/server";
import { getEventWithCorrelation } from "@/services/replay.service";
import { devToolsEnabled } from "@/lib/dev/gate";

/** Event Explorer (Fase 12) — detalhe de um evento: payload, correlação, e
 * duração real (tempo desde o primeiro evento da mesma correlação — nunca
 * uma métrica de processamento fabricada, que este produto não mede). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  const result = await getEventWithCorrelation(id);
  if (!result) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  return NextResponse.json(result);
}
