import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, hashIp } from "@/lib/ip";
import { rateLimit } from "@/lib/rate-limit";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { runScenario } from "@/services/scenario-engine.service";
import { SCENARIO_CATALOG, type ScenarioId } from "@/domain/demo/types";
import { handleApiError } from "@/lib/api-error";

const SCENARIO_IDS = new Set(SCENARIO_CATALOG.map((s) => s.id));

/**
 * Demo OS (Fase 12) — deliberadamente PÚBLICA, sem `requireAuthContext()`:
 * "funciona sem cadastro" é um requisito explícito desta fase, não um
 * descuido de segurança. Duas proteções reais em vez de uma sessão:
 * limite de taxa por IP (`demoScenario`, ver lib/rate-limit.ts) e o fato de
 * que TODA mutação atinge só a empresa fixa de demonstração
 * (`getDemoCompany()`, nunca aceita de fora) — o mesmo padrão já usado por
 * toda `/api/dev/demo/*` desde a Fase 6, agora também alcançável em
 * produção de propósito.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!SCENARIO_IDS.has(id as ScenarioId)) {
      return NextResponse.json({ error: "Cenário desconhecido" }, { status: 404 });
    }

    const ip = await getRequestIp();
    const { success } = await rateLimit("demoScenario", hashIp(ip));
    if (!success) return NextResponse.json({ error: "Muitas requisições, tente novamente em instantes." }, { status: 429 });

    const company = await getDemoCompany();
    if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada — rode o seed" }, { status: 404 });

    const result = await runScenario(company.id, id as ScenarioId);
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
