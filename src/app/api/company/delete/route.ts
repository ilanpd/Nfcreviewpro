import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext, requireRole, ForbiddenError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

const deleteSchema = z.object({ confirmName: z.string() });

/**
 * LGPD (Auditoria Nível Bilionário, 11/09/2026) — o lado "excluir" do
 * direito de exportar/excluir dados. Restrito a OWNER (não `settings:write`,
 * que ADMIN também tem) — apagar a empresa inteira é mais severo que
 * qualquer outra ação coberta por essa permissão, e irreversível: todo
 * `NFCCard`/`Campaign`/`Visit`/etc. desta empresa cai em cascata (ver
 * `onDelete: Cascade` no schema). Exige digitar o nome exato da empresa de
 * volta — mesmo padrão de confirmação usado por GitHub/Vercel para exclusão
 * de recurso irreversível, para nunca acontecer por um clique/script
 * acidental.
 */
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requireRole(ctx, ["OWNER"]);
    const { confirmName } = deleteSchema.parse(await req.json());

    const company = await prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId }, select: { name: true } });
    if (confirmName !== company.name) {
      throw new ForbiddenError(`Digite exatamente "${company.name}" para confirmar a exclusão.`);
    }

    await prisma.company.delete({ where: { id: ctx.companyId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
