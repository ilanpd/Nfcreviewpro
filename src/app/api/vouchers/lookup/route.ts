import { NextRequest, NextResponse } from "next/server";
import { lookupInputSchema } from "@/lib/validations/return-offer";
import { lookupVoucher } from "@/services/return-offer.service";
import { redeemFailureMessage } from "@/domain/return-offer/messages";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { handleApiError } from "@/lib/api-error";

/**
 * Consulta pública de um brinde pelo código (ADR-079): o cliente digitou o
 * código em outro celular. Sem PIN, porque o código é a credencial dele. Limite
 * de taxa por IP; a resposta de "não encontrado" é igual para código inexistente,
 * malformado ou de outra loja.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = await getRequestIp();
    const { success } = await rateLimit("voucherLookup", ip);
    if (!success) throw new Error("RATE_LIMITED");

    const input = lookupInputSchema.parse(await req.json());
    const result = await lookupVoucher(input);
    if (!result.ok) return NextResponse.json({ error: redeemFailureMessage("NOT_FOUND") }, { status: 404 });
    return NextResponse.json({ voucher: result.voucher });
  } catch (error) {
    return handleApiError(error);
  }
}
