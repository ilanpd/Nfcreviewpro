import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { getModelVersionFull } from "@/services/plates.service";

/** A arte de fundo de uma versão, para o editor visual. Imutável por versão, então pode ficar em cache no navegador. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlateAdmin();
    const { id } = await params;
    const versionParam = Number(req.nextUrl.searchParams.get("v"));
    const version = await getModelVersionFull(id, Number.isInteger(versionParam) && versionParam > 0 ? versionParam : undefined);
    if (!version?.background || !version.backgroundMime) return NextResponse.json({ error: "Sem arte nesta versão" }, { status: 404 });
    return new NextResponse(new Uint8Array(version.background), {
      headers: { "Content-Type": version.backgroundMime, "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
