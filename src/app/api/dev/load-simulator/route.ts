import { NextRequest, NextResponse } from "next/server";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { prisma } from "@/lib/prisma";
import { publishEvent } from "@/lib/event-bus";
import { handleApiError } from "@/lib/api-error";
import { devToolsEnabled } from "@/lib/dev/gate";

/**
 * Simulador de Carga da Bella Vista (Fase 8) — dispara uma rajada de
 * eventos `NFCTocado`/`RedirecionamentoResolvido` de verdade (mesmo
 * `publishEvent` que o Resolution Engine usa em produção) contra a empresa
 * de demonstração, para o Mission Control/Painel de Saúde mostrarem filas
 * enchendo e workers processando de forma visível — sem esperar tráfego
 * real chegar. Nunca cria um `RedirectLog` (não simula tráfego HTTP de
 * verdade, só o efeito no Event Bus/Queue Engine); local dev/preview only.
 */
export async function POST(req: NextRequest) {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const company = await getDemoCompany();
    if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada — rode o seed" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const count = Math.max(1, Math.min(500, Number(body?.count) || 100));

    const cards = await prisma.nFCCard.findMany({ where: { companyId: company.id }, select: { id: true, uniqueCode: true } });
    if (cards.length === 0) return NextResponse.json({ error: "A empresa de demonstração não tem cartões — rode o seed" }, { status: 404 });

    let published = 0;
    await Promise.all(
      Array.from({ length: count }).map(async () => {
        const card = cards[Math.floor(Math.random() * cards.length)];
        try {
          await publishEvent("NFCTocado", { cardId: card.id, uniqueCode: card.uniqueCode }, { companyId: company.id });
          await publishEvent(
            "RedirecionamentoResolvido",
            { cardId: card.id, campaignId: null, variantId: null, outcome: "REVIEW_FLOW_FALLBACK", resolvedFromCache: Math.random() > 0.5 },
            { companyId: company.id }
          );
          published += 2;
        } catch {
          // best-effort — o simulador não deve travar por um único evento
        }
      })
    );

    return NextResponse.json({ published, cards: cards.length });
  } catch (error) {
    return handleApiError(error);
  }
}
