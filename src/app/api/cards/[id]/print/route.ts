import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { renderPrintAsset } from "@/services/print-assets.service";
import { isPrintTemplateId, PRINT_TEMPLATE_IDS } from "@/domain/white-label/print-templates";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const templateParam = req.nextUrl.searchParams.get("template") ?? "sticker";
    if (!isPrintTemplateId(templateParam)) {
      return NextResponse.json({ error: `"template" deve ser um de: ${PRINT_TEMPLATE_IDS.join(", ")}.` }, { status: 400 });
    }

    const pdf = await renderPrintAsset(ctx.companyId, id, templateParam);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${templateParam}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
