import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { renderPrintAsset } from "@/services/print-assets.service";
import { isPrintTemplateId, PRINT_TEMPLATE_IDS } from "@/domain/white-label/print-templates";
import { handleApiError } from "@/lib/api-error";
import { withConcurrencyLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const templateParam = req.nextUrl.searchParams.get("template") ?? "sticker";
    if (!isPrintTemplateId(templateParam)) {
      return NextResponse.json({ error: `"template" deve ser um de: ${PRINT_TEMPLATE_IDS.join(", ")}.` }, { status: 400 });
    }

    const slot = await withConcurrencyLimit("print", ctx.userId, 2, async () => {
      const pdf = await renderPrintAsset(ctx.companyId, id, templateParam);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${templateParam}.pdf"`,
        },
      });
    });
    if (!slot.ok) return NextResponse.json({ error: "Você já tem exportações em andamento. Aguarde terminarem e tente de novo." }, { status: 429, headers: { "Retry-After": "10" } });
    return slot.value;
  } catch (error) {
    return handleApiError(error);
  }
}
