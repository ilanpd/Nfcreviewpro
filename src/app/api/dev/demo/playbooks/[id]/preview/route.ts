import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getExecutionPreview } from "@/services/recommendation-engine.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  try {
    const company = await getDemoCompany();
    if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada" }, { status: 404 });
    const { id } = await params;
    const preview = await getExecutionPreview(company.id, id);
    return NextResponse.json({ preview });
  } catch (error) {
    return handleApiError(error);
  }
}
