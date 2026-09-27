import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/super-admin";
import { handleApiError } from "@/lib/api-error";
import { addStoreOrderNote, listStoreOrderNotes } from "@/services/store-order.service";

const bodySchema = z.object({ body: z.string().trim().min(1, "A nota não pode estar vazia").max(2000) });

/** Auditoria do Fluxo de Vendas (12/09/2026) — notas internas por pedido
 * ("cliente ligou reclamando de atraso"), nunca visíveis ao comprador. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const notes = await listStoreOrderNotes(id);
    return NextResponse.json({ notes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const { body } = bodySchema.parse(await req.json());
    const note = await addStoreOrderNote(id, body);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
