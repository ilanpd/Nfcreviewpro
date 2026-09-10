import { NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { inspectCardState } from "@/services/state-inspector.service";
import { devToolsEnabled } from "@/lib/dev/gate";

export async function GET(_req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada" }, { status: 404 });
  const { cardId } = await params;
  const state = await inspectCardState(company.id, cardId);
  if (!state) return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });
  return NextResponse.json({ state });
}
