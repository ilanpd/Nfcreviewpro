import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

const RESULT_LIMIT = 5;

/**
 * Fase 19.1 — Command+K global do Admin. Busca rasa (`contains`/insensitive,
 * mesmo padrão já usado em `admin/empresas` e na Tabela de Pedidos) em vez
 * de infra de busca nova — a escala atual (centenas, não milhões, de
 * empresas/pedidos) não justifica Elastic/Algolia.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json({ companies: [], orders: [], cards: [] });

    const [companies, orders, cards] = await Promise.all([
      prisma.company.findMany({
        where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] },
        select: { id: true, name: true, plan: true },
        take: RESULT_LIMIT,
      }),
      prisma.storeOrder.findMany({
        where: {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
            { trackingCode: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, customerName: true, customerEmail: true, status: true },
        take: RESULT_LIMIT,
      }),
      prisma.nFCCard.findMany({
        where: { OR: [{ uniqueCode: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
        select: { id: true, name: true, uniqueCode: true, companyId: true },
        take: RESULT_LIMIT,
      }),
    ]);

    return NextResponse.json({
      companies: companies.map((c) => ({ id: c.id, label: c.name, subtitle: c.plan, href: `/admin/empresas/${c.id}` })),
      orders: orders.map((o) => ({ id: o.id, label: o.customerName, subtitle: `${o.customerEmail} · ${o.status}`, href: `/admin/pedidos` })),
      cards: cards.map((c) => ({ id: c.id, label: c.name, subtitle: c.uniqueCode, href: `/admin/empresas/${c.companyId}` })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
