import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveBrandByHost } from "@/lib/white-label/resolve-brand";
import { buildBrandColorSet } from "@/domain/white-label/color";
import { DEFAULT_PRIMARY_COLOR } from "@/domain/white-label/types";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";

// C12 (ADR-087) — logo oficial (glifo "P" metálico, `public/brand/`), lido
// uma vez no escopo do módulo (reaproveitado entre invocações a quente da
// function) e embutido como data URI — o único jeito de um asset estático
// aparecer dentro de um `ImageResponse` (satori não busca URL relativa do
// próprio deploy). Só usado quando NENHUMA empresa com marca própria está
// por trás do Host (branch `!brand` abaixo) — white-label continua 100% a
// cor/inicial da empresa cliente, nunca o glifo do produto.
const LOGO_MARK_DATA_URI = `data:image/png;base64,${readFileSync(path.join(process.cwd(), "public/brand/logo-mark.png")).toString("base64")}`;

/**
 * Assets Inteligentes (Fase 10) — favicon dinâmico, resolvido por Host a
 * cada requisição via o mesmo `DomainResolver` do middleware (cacheado —
 * ver `resolve-brand.ts`). No domínio raiz do produto, `resolveBrandByHost`
 * devolve `null` e este favicon volta ao ícone padrão do Pulse —
 * white-label só entra em cena quando a empresa acessa pelo próprio
 * subdomínio/domínio. Sem um `faviconUrl` configurado, gera um ícone com a
 * inicial do nome sobre a cor da marca em vez de um genérico — todo
 * tenant ganha uma identidade mínima, mesmo antes de subir um arquivo.
 */
// Apple Touch Icon (180) e ícones de PWA (192/512 — preparação, ver ADR-043)
// pedem tamanhos maiores do mesmo favicon; nunca um segundo endpoint, só um
// parâmetro do mesmo gerador.
const ALLOWED_SIZES = [32, 180, 192, 512];

export async function GET(req: NextRequest) {
  const brand = await resolveBrandByHost(req.headers.get("host"));
  const requestedSize = Number(req.nextUrl.searchParams.get("size"));
  const size = ALLOWED_SIZES.includes(requestedSize) ? requestedSize : 32;

  if (brand?.faviconUrl) {
    return NextResponse.redirect(brand.faviconUrl);
  }

  const colors = buildBrandColorSet(brand?.primaryColor ?? DEFAULT_PRIMARY_COLOR, brand?.secondaryColor);
  const initial = (brand?.name ?? BRAND.name).trim().charAt(0).toUpperCase();
  const background = brand ? colors.primary : BRAND.colors.ink;
  const glyph = brand ? colors.onPrimary : BRAND.colors.violetOnDark;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
        }}
      >
        {brand ? (
          <span style={{ color: glyph, fontSize: Math.round(size * 0.55), fontWeight: 700, fontFamily: "sans-serif" }}>
            {initial}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) exige <img>, nunca next/image.
          <img src={LOGO_MARK_DATA_URI} width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} alt="" />
        )}
      </div>
    ),
    { width: size, height: size }
  );
}
