import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { getStoreProduct } from "@/lib/store-products";

/** Auditoria do Fluxo de Vendas (12/09/2026) — exportação pra contabilidade,
 * que antes não existia pra pedidos (só pra feedback). Sem filtro, exporta
 * o histórico inteiro; `?status=` filtra por um status específico. */
export async function GET(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const status = req.nextUrl.searchParams.get("status");

    const orders = await prisma.storeOrder.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: "desc" },
    });

    const rows = orders.map((o) => ({
      id: o.id,
      data: o.createdAt.toISOString(),
      status: o.status,
      tipo: o.orderType,
      cliente: o.customerName,
      email: o.customerEmail,
      documento: o.customerDocument ?? "",
      telefone: o.customerPhone ?? "",
      produto: getStoreProduct(o.productId)?.name ?? o.productId,
      quantidade: o.quantity,
      valorTotal: (o.amountTotalCents / 100).toFixed(2),
      transportadora: o.carrier ?? "",
      rastreio: o.trackingCode ?? "",
      reembolsado: o.refundAmountCents != null ? (o.refundAmountCents / 100).toFixed(2) : "",
      disputa: o.disputeStatus ?? "",
    }));

    const csv = toCsv(rows, [
      { key: "id", header: "ID do pedido" },
      { key: "data", header: "Data" },
      { key: "status", header: "Status" },
      { key: "tipo", header: "Tipo" },
      { key: "cliente", header: "Cliente" },
      { key: "email", header: "E-mail" },
      { key: "documento", header: "CPF/CNPJ" },
      { key: "telefone", header: "Telefone" },
      { key: "produto", header: "Produto" },
      { key: "quantidade", header: "Quantidade" },
      { key: "valorTotal", header: "Valor total (R$)" },
      { key: "transportadora", header: "Transportadora" },
      { key: "rastreio", header: "Rastreio" },
      { key: "reembolsado", header: "Reembolsado (R$)" },
      { key: "disputa", header: "Status de disputa" },
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pedidos-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
