import { NextResponse } from "next/server";
import { getReliabilitySnapshot } from "@/services/reliability.service";

/**
 * Alimenta o polling do Painel de Saúde (`/dev/ceo/reliability`) e do
 * Mission Control (`/dev/ceo/mission-control`) — nunca existe fora de
 * desenvolvimento/preview, e não exige sessão porque os dados aqui são
 * operacionais (filas, cache, Redis), não de um tenant específico.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snapshot = await getReliabilitySnapshot();
  return NextResponse.json({ snapshot });
}
