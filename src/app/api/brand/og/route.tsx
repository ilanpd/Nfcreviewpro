import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { resolveBrandByHost } from "@/lib/white-label/resolve-brand";
import { buildBrandColorSet } from "@/domain/white-label/color";
import { DEFAULT_PRIMARY_COLOR } from "@/domain/white-label/types";

export const runtime = "nodejs";

/** Open Graph / Twitter Card dinâmico (Fase 10) — mesmo `DomainResolver`
 * do favicon. Um link para a página de login/cadastro de uma empresa
 * white-label, compartilhado no WhatsApp/LinkedIn/etc., mostra o preview
 * com a marca dela, não a do produto genérico. */
export async function GET(req: NextRequest) {
  const brand = await resolveBrandByHost(req.headers.get("host"));
  const colors = buildBrandColorSet(brand?.primaryColor ?? DEFAULT_PRIMARY_COLOR, brand?.secondaryColor);
  const name = brand?.name ?? "NFC OS";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: colors.secondary,
        }}
      >
        {brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={name} width={120} height={120} style={{ objectFit: "contain" }} />
        ) : (
          <div
            style={{
              display: "flex",
              width: 120,
              height: 120,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              background: colors.primary,
              color: colors.onPrimary,
              fontSize: 56,
              fontWeight: 700,
              fontFamily: "sans-serif",
            }}
          >
            {name.trim().charAt(0).toUpperCase()}
          </div>
        )}
        <span style={{ fontSize: 48, fontWeight: 700, color: colors.primary, fontFamily: "sans-serif" }}>{name}</span>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
