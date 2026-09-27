import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isWellFormedCardCode } from "@/lib/codes";
import { getCardUrlGuard, cardPublicUrl } from "@/lib/card-url";
import { generateQrPngBuffer, generateQrSvg } from "@/lib/qrcode";

// Tamanhos fixos, não um intervalo livre: cada combinação vira uma entrada de
// cache, e um intervalo aberto deixaria qualquer um gerar centenas de imagens
// diferentes por cartão.
const querySchema = z.object({
  size: z.enum(["128", "256", "512", "1024"]).default("512").transform(Number),
  format: z.enum(["png", "svg"]).default("png"),
  download: z.literal("1").optional(),
});

/**
 * QR do cartão, gerado sob demanda (ADR-076). Público e sem banco: o QR é uma
 * função pura do código e do endereço do cartão, e a mesma URL já está
 * impressa no cartão. Com `CARD_URL_REQUIRE_FINAL=1` e endereço ainda
 * provisório, recusa gerar — um QR impresso com ele quebraria depois.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isWellFormedCardCode(code)) return NextResponse.json({ error: "Código inválido" }, { status: 404 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  const { size, format, download } = parsed.data;

  const guard = getCardUrlGuard();
  if (guard.blocked) return NextResponse.json({ error: guard.message }, { status: 503 });

  const target = cardPublicUrl(code);
  const headers: Record<string, string> = {
    // Uma hora no navegador, um dia no CDN: se o domínio mudar, o QR novo
    // aparece em até um dia sem ninguém precisar limpar cache à mão.
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="qrcode-${code}.${format}"`;

  if (format === "svg") {
    const svg = await generateQrSvg(target, size);
    return new NextResponse(svg, { headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" } });
  }
  const png = await generateQrPngBuffer(target, size);
  return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}
