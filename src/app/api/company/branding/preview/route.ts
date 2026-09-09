import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateBrandedQrPngDataUrl, cardPublicUrl } from "@/lib/qrcode";
import { buildBrandColorSet } from "@/domain/white-label/color";
import { handleApiError } from "@/lib/api-error";

const previewSchema = z.object({
  primaryColor: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/),
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/)
    .nullable()
    .optional(),
});

/**
 * Theme Studio (Fase 10) — gera um QR de exemplo com cores AINDA NÃO
 * salvas, para o preview ao vivo mudar instantaneamente ao arrastar um
 * seletor de cor, sem exigir "Salvar" primeiro. Nunca persiste nada —
 * só renderiza contra um cartão real da empresa (se existir) ou uma URL
 * de exemplo, quando a empresa ainda não tem nenhum cartão.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const { primaryColor, secondaryColor } = previewSchema.parse(await req.json());

    const sampleCard = await prisma.nFCCard.findFirst({ where: { companyId: ctx.companyId }, select: { uniqueCode: true } });
    const targetUrl = sampleCard ? cardPublicUrl(sampleCard.uniqueCode) : cardPublicUrl("PREVIEW");

    const colors = buildBrandColorSet(primaryColor, secondaryColor);
    const qrDataUrl = await generateBrandedQrPngDataUrl(targetUrl, { darkColor: colors.primary, size: 320 });

    return NextResponse.json({ qrDataUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
