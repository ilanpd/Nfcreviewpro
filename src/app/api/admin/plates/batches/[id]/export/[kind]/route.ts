import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { fileResponse, requirePlateAdmin } from "@/lib/plates/admin-route";
import { buildBatchManifest, buildBatchPdf, buildProductionSheet } from "@/services/plate-exports.service";

export const maxDuration = 60;

/**
 * Os três arquivos do lote para a gráfica: `pdf` (arte, uma página por placa),
 * `manifest` (CSV) e `sheet` (ficha de produção A4). `?serials=L001-03,L001-07`
 * reimprime só essas placas. Com `CARD_URL_REQUIRE_FINAL=1` e endereço
 * provisório, `pdf` e `manifest` recusam (503) — a ficha sai mesmo assim, com
 * o aviso impresso.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
  try {
    await requirePlateAdmin();
    const { id, kind } = await params;
    if (kind === "pdf") {
      const serials = req.nextUrl.searchParams
        .get("serials")
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const file = await buildBatchPdf(id, { serials });
      return fileResponse(file.bytes, file.filename, "application/pdf");
    }
    if (kind === "manifest") {
      const file = await buildBatchManifest(id);
      return fileResponse(file.bytes, file.filename, "text/csv; charset=utf-8");
    }
    if (kind === "sheet") {
      const file = await buildProductionSheet(id);
      return fileResponse(file.bytes, file.filename, "application/pdf");
    }
    return NextResponse.json({ error: "Tipo de arquivo desconhecido" }, { status: 404 });
  } catch (error) {
    return handleApiError(error);
  }
}
