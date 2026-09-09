import { NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listAssignmentsForStatus } from "@/services/table-map.service";

/** Equivalente de `/api/table-map/assignments` para o Command Center — ver ADR-027. */
export async function GET() {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada — rode o seed" }, { status: 404 });

  const assignments = await listAssignmentsForStatus(company.id, company.organizationId);
  return NextResponse.json({ assignments });
}
