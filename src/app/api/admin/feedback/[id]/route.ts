import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/prisma";
import { setFeedbackResolved } from "@/services/feedback.service";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({ resolved: z.boolean() });

/**
 * Central do Cliente (Fase 19.7) — o campo `resolved` de `PrivateFeedback` já
 * tinha um toggle de escrita no `/dashboard` (`/api/feedback/[id]`, scoped
 * por `requireAuthContext().companyId`); faltava o equivalente no Admin, que
 * não tem uma sessão de empresa para escopar sozinho. Reaproveita o mesmo
 * `setFeedbackResolved` (nunca uma segunda cópia da lógica de update) —
 * só resolve o `companyId` a partir do próprio feedback antes de chamá-lo.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const { resolved } = bodySchema.parse(await req.json());

    const existing = await prisma.privateFeedback.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing) return NextResponse.json({ error: "Feedback não encontrado" }, { status: 404 });

    const feedback = await setFeedbackResolved(existing.companyId, id, resolved);
    return NextResponse.json({ feedback });
  } catch (error) {
    return handleApiError(error);
  }
}
