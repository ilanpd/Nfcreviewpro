import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listApiRequestLogs, getApiUsageSummary } from "@/services/api-request-log.service";

/**
 * Network Inspector (Fase 12) — toda chamada `/api/v1/**` já é gravada em
 * `ApiRequestLog` desde a Fase 9 (duração/status/rota); esta rota só expõe
 * essas linhas para a nova tela, nunca duplica a gravação.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const company = await getDemoCompany();
  if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada" }, { status: 404 });

  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
  const [logs, summary] = await Promise.all([listApiRequestLogs(company.id, cursor, 20), getApiUsageSummary(company.id)]);
  const hasMore = logs.length > 20;
  return NextResponse.json({ logs: logs.slice(0, 20), nextCursor: hasMore ? logs[20].id : null, summary });
}
