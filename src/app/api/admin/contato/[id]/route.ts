import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/super-admin";
import { setContactMessageResponded } from "@/services/contact.service";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({ responded: z.boolean() });

/** Marca uma mensagem de /contato como respondida (ou reabre) — só o super-admin. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const { responded } = bodySchema.parse(await req.json());
    const message = await setContactMessageResponded(id, responded);
    return NextResponse.json({ message });
  } catch (error) {
    return handleApiError(error);
  }
}
