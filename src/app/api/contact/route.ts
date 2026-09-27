import { NextRequest, NextResponse } from "next/server";
import { createContactMessageSchema } from "@/lib/validations/contact";
import { createContactMessage } from "@/services/contact.service";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { handleApiError } from "@/lib/api-error";

/** Público: formulário de /contato (C9/F6) — nenhuma conta necessária. */
export async function POST(req: NextRequest) {
  try {
    const ip = await getRequestIp();
    const { success } = await rateLimit("contact", ip);
    if (!success) throw new Error("RATE_LIMITED");

    const input = createContactMessageSchema.parse(await req.json());
    await createContactMessage(input);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
