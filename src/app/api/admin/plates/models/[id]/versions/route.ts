import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requirePlateAdmin } from "@/lib/plates/admin-route";
import { plateModelVersionSchema } from "@/lib/validations/plates";
import { savePlateModelVersion, type BackgroundUpload } from "@/services/plates.service";

/**
 * Salvar = criar a PRÓXIMA versão (a anterior nunca é editada). Multipart: o
 * layout vai como JSON no campo `layout` e a arte, se trocada, no campo
 * `background`. O corpo da requisição na Vercel tem teto de ~4,5 MB, por isso a
 * arte é limitada a 3,5 MB (checado no serviço, com mensagem clara).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePlateAdmin();
    const { id } = await params;
    const form = await req.formData();

    let raw: unknown;
    try {
      raw = JSON.parse(String(form.get("layout") ?? ""));
    } catch {
      return NextResponse.json({ error: "Layout inválido" }, { status: 400 });
    }
    const { note, background, ...layout } = plateModelVersionSchema.parse(raw);

    let upload: BackgroundUpload | undefined;
    const file = form.get("background");
    if (file instanceof File && file.size > 0) {
      upload = { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type, name: file.name };
    }
    const result = await savePlateModelVersion(
      id,
      { layout, note, background: upload ? "replace" : background === "replace" ? "keep" : background, upload },
      actor
    );
    return NextResponse.json({ version: result.version, warnings: result.check.warnings }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
