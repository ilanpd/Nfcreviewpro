import { NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { withConcurrencyLimit } from "@/lib/rate-limit";

/**
 * LGPD (Auditoria Nível Bilionário, 11/09/2026) — antes desta rota, não
 * existia NENHUMA forma de uma empresa cliente exportar os próprios dados.
 * A lei brasileira de proteção de dados exige essa possibilidade para o
 * titular dos dados; aqui o titular é a empresa (dono da conta), que já
 * está autenticado e cujos dados já são inteiramente escopados por
 * `companyId` — não precisa de um fluxo de verificação de identidade à
 * parte, diferente do consumidor final anônimo que toca um cartão (esse
 * caso fica deliberadamente fora daqui — pedir e verificar a identidade de
 * alguém que nunca criou conta é um problema de produto/design próprio,
 * não uma rota de API que dá pra resolver com segurança sob pressão de
 * tempo).
 */
export async function GET() {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");

    // No máximo 2 exportações simultâneas por usuário (esta junta 9 consultas grandes).
    const slot = await withConcurrencyLimit("export", ctx.userId, 2, async () => {
      const [company, users, cards, campaigns, campaignAssignments, branches, zones, storeOrders, auditLogs] = await Promise.all([
        prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } }),
        prisma.user.findMany({ where: { companyId: ctx.companyId }, select: { id: true, name: true, email: true, role: true, status: true, createdAt: true } }),
        prisma.nFCCard.findMany({ where: { companyId: ctx.companyId } }),
        prisma.campaign.findMany({ where: { companyId: ctx.companyId } }),
        prisma.campaignAssignment.findMany({ where: { companyId: ctx.companyId } }),
        prisma.branch.findMany({ where: { companyId: ctx.companyId } }),
        prisma.zone.findMany({ where: { companyId: ctx.companyId } }),
        prisma.storeOrder.findMany({ where: { companyId: ctx.companyId } }),
        prisma.auditLog.findMany({ where: { companyId: ctx.companyId }, take: 5000, orderBy: { createdAt: "desc" } }),
      ]);

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        company,
        users,
        cards,
        campaigns,
        campaignAssignments,
        branches,
        zones,
        storeOrders,
        auditLogs,
      };

      return new NextResponse(JSON.stringify(exportPayload, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="nfc-os-dados-${ctx.companyId}.json"`,
        },
    });
    });
    if (!slot.ok) return NextResponse.json({ error: "Você já tem exportações em andamento. Aguarde terminarem e tente de novo." }, { status: 429, headers: { "Retry-After": "10" } });
    return slot.value;
  } catch (error) {
    return handleApiError(error);
  }
}
