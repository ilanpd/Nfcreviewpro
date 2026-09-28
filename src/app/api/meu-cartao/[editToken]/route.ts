import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { findGuestCard, getCardDestination, countCardTouchesThisMonth, updateCardDestination } from "@/services/meu-cartao.service";

/**
 * Portal leve para clientes GUEST (Fase 18) — acesso por link pessoal
 * (`editToken`), nunca por senha/login. Um link cuja empresa já virou
 * assinante devolve 409 aqui (a UI só usa PATCH; a navegação de página usa o
 * redirect ao painel em `page.tsx`) — nunca 404, que sugeriria link quebrado.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ editToken: string }> }) {
  try {
    const { editToken } = await params;
    const lookup = await findGuestCard(editToken);
    if (lookup.status === "NOT_FOUND") return NextResponse.json({ error: "Link inválido" }, { status: 404 });
    if (lookup.status === "GRADUATED") return NextResponse.json({ error: "Esta empresa já é assinante — use o painel" }, { status: 409 });

    const { card } = lookup;
    const { destinationUrl } = await getCardDestination(card.id, card.company.googleReviewUrl ?? "");
    const visitsThisMonth = await countCardTouchesThisMonth(card.id);
    return NextResponse.json({ name: card.name, destinationUrl, visitsThisMonth });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({ destinationUrl: z.string().url("Informe um link válido (ex: https://...)") });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ editToken: string }> }) {
  try {
    const { editToken } = await params;
    const lookup = await findGuestCard(editToken);
    if (lookup.status === "NOT_FOUND") return NextResponse.json({ error: "Link inválido" }, { status: 404 });
    if (lookup.status === "GRADUATED") return NextResponse.json({ error: "Esta empresa já é assinante — use o painel" }, { status: 409 });

    const { destinationUrl } = patchSchema.parse(await req.json());
    await updateCardDestination(lookup.card.companyId, lookup.card.id, destinationUrl);
    return NextResponse.json({ destinationUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
