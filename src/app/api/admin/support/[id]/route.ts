import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/super-admin";
import { setSupportRequestStatus } from "@/services/support.service";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]) });

/** Central de Suporte (Fase 20) — lado Admin: muda o status de um chamado.
 * Mesmo padrão de `/api/admin/feedback/[id]` (Fase 19.7). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const { status } = bodySchema.parse(await req.json());
    const request = await setSupportRequestStatus(id, status);
    return NextResponse.json({ request });
  } catch (error) {
    return handleApiError(error);
  }
}
