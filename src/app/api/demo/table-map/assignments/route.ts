import { NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listAssignmentsForStatus } from "@/services/table-map.service";

/** Demo OS (Fase 12) — equivalente PÚBLICO de `/api/dev/demo/table-map/assignments`. */
export async function GET() {
  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada" }, { status: 404 });

  const assignments = await listAssignmentsForStatus(company.id, company.organizationId);
  return NextResponse.json({ assignments });
}
