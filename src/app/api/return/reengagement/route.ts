import { NextRequest, NextResponse } from "next/server";
import { runReturnReengagementSweep } from "@/services/return-offer.service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reengajamento D+7/D+30 do Retorno (C9/F6, J7 do plano) — varredura diária,
 * protegida por `CRON_SECRET` (mesmo padrão de `/api/playbooks/evaluate`,
 * ver ADR-033). A decisão de quem está devendo um lembrete é 100% de
 * `services/return-offer.service.ts` (`runReturnReengagementSweep`), que usa
 * a função pura `domain/return-offer/reengagement.ts` — esta rota só expõe o
 * relógio.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado — rota desabilitada" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await runReturnReengagementSweep();
  return NextResponse.json(result);
}
