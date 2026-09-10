import { NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getCommandCenterSnapshot } from "@/services/command-center.service";
import { devToolsEnabled } from "@/lib/dev/gate";

export async function GET() {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada" }, { status: 404 });
  const snapshot = await getCommandCenterSnapshot(company.id);
  return NextResponse.json({ snapshot });
}
