import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { markPrimaryClick } from "@/services/visit.service";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { handleApiError } from "@/lib/api-error";

/**
 * Registra que o cliente tocou no botão principal (o destino do dono). Público,
 * melhor esforço e idempotente: o cliente nunca espera por isto para seguir
 * ao destino (ADR-080).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = await getRequestIp();
    const { success } = await rateLimit("publicCard", ip);
    if (!success) throw new Error("RATE_LIMITED");
    const { id } = await params;
    const visitId = z.string().cuid().parse(id);
    await markPrimaryClick(visitId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
