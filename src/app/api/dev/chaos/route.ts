import { NextRequest, NextResponse } from "next/server";
import { CHAOS_FLAGS, getAllChaosFlags, setChaosFlag, type ChaosFlag } from "@/lib/chaos/flags";
import { devToolsEnabled } from "@/lib/dev/gate";

/**
 * Chaos Engine (Fase 8) — liga/desliga as 5 flags de injeção de falha para
 * demonstração. Gate duplo de segurança: esta rota inteira só existe fora de
 * produção, E `setChaosFlag`/`isChaosActive` já se recusam a agir em
 * produção mesmo se alguém chamasse esta rota lá por engano — ver
 * `lib/chaos/flags.ts`.
 */
export async function GET() {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const flags = await getAllChaosFlags();
  return NextResponse.json({ flags });
}

export async function POST(req: NextRequest) {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const flag = body?.flag as ChaosFlag | undefined;
  const active = Boolean(body?.active);

  if (!flag || !CHAOS_FLAGS.includes(flag)) {
    return NextResponse.json({ error: "Flag inválida" }, { status: 400 });
  }

  await setChaosFlag(flag, active);
  const flags = await getAllChaosFlags();
  return NextResponse.json({ flags });
}
