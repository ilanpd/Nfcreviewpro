import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { fileResponse, requirePlateAdmin } from "@/lib/plates/admin-route";
import { buildBatchManifest, buildBatchPdf, buildProductionSheet } from "@/services/plate-exports.service";
import { withConcurrencyLimit } from "@/lib/rate-limit";

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
    const admin = await requirePlateAdmin();
    const { id, kind } = await params;
    // PDF de 20+ paginas com arte pesada: no maximo 2 por vez por admin.
    const slot = await withConcurrencyLimit("plate-export", admin, 2, async () => {
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
    });
    if (!slot.ok) return NextResponse.json({ error: "Você já tem exportações em andamento. Aguarde terminarem e tente de novo." }, { status: 429, headers: { "Retry-After": "10" } });
    return slot.value;
  } catch (error) {
    return handleApiError(error);
  }
}
