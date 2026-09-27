import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPersonalLinkRecoveryEmail } from "@/services/meu-cartao.service";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({ email: z.string().trim().email() });

/**
 * "Perdi o link pessoal" (ADR-080, J7 do plano). Responde SEMPRE com a mesma
 * mensagem, exista ou não um cartão para o e-mail — nunca revela se alguém
 * comprou aqui. O envio em si é melhor esforço (sendEmail nunca lança).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = await getRequestIp();
    const { success } = await rateLimit("personalLinkRecovery", ip);
    if (!success) throw new Error("RATE_LIMITED");

    const { email } = bodySchema.parse(await req.json());
    await sendPersonalLinkRecoveryEmail(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
