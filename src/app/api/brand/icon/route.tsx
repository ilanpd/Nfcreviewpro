import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveBrandByHost } from "@/lib/white-label/resolve-brand";
import { buildBrandColorSet } from "@/domain/white-label/color";
import { DEFAULT_PRIMARY_COLOR } from "@/domain/white-label/types";

export const runtime = "nodejs";

/**
 * Assets Inteligentes (Fase 10) — favicon dinâmico, resolvido por Host a
 * cada requisição via o mesmo `DomainResolver` do middleware (cacheado —
 * ver `resolve-brand.ts`). No domínio raiz do produto, `resolveBrandByHost`
 * devolve `null` e este favicon volta ao ícone padrão do NFC OS —
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
  const initial = (brand?.name ?? "N").trim().charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.primary,
        }}
      >
        <span style={{ color: colors.onPrimary, fontSize: Math.round(size * 0.55), fontWeight: 700, fontFamily: "sans-serif" }}>
          {initial}
        </span>
      </div>
    ),
    { width: size, height: size }
  );
}
