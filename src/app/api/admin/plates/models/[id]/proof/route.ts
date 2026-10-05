import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { fileResponse, requirePlateAdmin } from "@/lib/plates/admin-route";
import { buildModelProofPdf } from "@/services/plate-exports.service";

/** PDF de prova: a arte como a gráfica a receberia, com QR e série de exemplo. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlateAdmin();
    const { id } = await params;
    const versionParam = Number(req.nextUrl.searchParams.get("v"));
    const file = await buildModelProofPdf(id, Number.isInteger(versionParam) && versionParam > 0 ? versionParam : undefined);
    return fileResponse(file.bytes, file.filename, "application/pdf");
  } catch (error) {
    return handleApiError(error);
  }
}
