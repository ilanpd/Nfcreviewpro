import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { evaluatePlaybooksForCompany } from "@/services/playbook-engine.service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Playbook Engine (Fase 11) — varredura periódica, protegida por
 * `CRON_SECRET` (mesmo padrão de `/api/queues/process`, ver ADR-033).
 * Necessária porque nem todo gatilho de Playbook tem um evento para reagir:
 * uma zona silenciosa ou uma mesa VIP parada não geram NENHUM evento no
 * Event Bus (a ausência de comportamento é o próprio sinal) — só uma
 * varredura por tempo consegue perceber isso. Gatilhos de comportamento real
 * (toque, avaliação, feedback) já são cobertos, com latência muito menor,
 * pela fila "playbooks" do Event Bus (ver `lib/workers/processors.ts`) —
 * esta rota é o complemento, não a via principal.
 *
 * Varre TODAS as empresas — uma escolha simples e honesta para a escala
 * real deste produto hoje; documentado como um limite conhecido (não uma
 * suposição) para revisitar se o número de empresas crescer para milhares
 * (ver Franchise First Review em RELATORIO_FASE_11.md).
 */
export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req.headers.get("authorization"));
  if (auth === "disabled") {
    return NextResponse.json({ error: "CRON_SECRET não configurado — rota desabilitada" }, { status: 503 });
  }
  if (auth !== "ok") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const companies = await prisma.company.findMany({ select: { id: true } });
  let totalCreated = 0;
  for (const company of companies) {
    totalCreated += await evaluatePlaybooksForCompany(company.id);
  }

  return NextResponse.json({ companiesEvaluated: companies.length, recommendationsCreated: totalCreated });
}
