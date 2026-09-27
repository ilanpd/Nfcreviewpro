import { NextRequest, NextResponse } from "next/server";
import { redeemInputSchema } from "@/lib/validations/return-offer";
import { redeemVoucher } from "@/services/return-offer.service";
import { redeemFailureMessage, redeemFailureStatus } from "@/domain/return-offer/messages";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { handleApiError } from "@/lib/api-error";

/**
 * Resgate público (ADR-079): código do brinde + PIN da loja, digitados na tela
 * do cliente com o atendente ao lado. Sem sessão: quem autoriza é o PIN. Três
 * camadas contra tentativa em massa: limite por IP aqui, limite de falhas por
 * brinde (5 em 10 minutos) e por empresa (20 em 10 minutos) no serviço.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = await getRequestIp();
    const { success } = await rateLimit("voucherRedeem", ip);
    if (!success) throw new Error("RATE_LIMITED");

    const input = redeemInputSchema.parse(await req.json());
    const result = await redeemVoucher(input);
    if (result.ok) return NextResponse.json({ ok: true, title: result.title });

    const body: Record<string, unknown> = { ok: false, reason: result.reason, error: redeemFailureMessage(result.reason) };
    if (result.reason === "WRONG_PIN") body.remainingAttempts = result.remainingAttempts;
    if (result.reason === "TOO_MANY_ATTEMPTS") body.retryAt = result.retryAt;
    return NextResponse.json(body, { status: redeemFailureStatus(result.reason) });
  } catch (error) {
    return handleApiError(error);
  }
}
