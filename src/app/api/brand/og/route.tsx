import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveBrandByHost } from "@/lib/white-label/resolve-brand";
import { buildBrandColorSet } from "@/domain/white-label/color";
import { DEFAULT_PRIMARY_COLOR } from "@/domain/white-label/types";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";

// C12 (ADR-087) — mesmo logo oficial do favicon (`api/brand/icon`), agora o
// lockup completo (glifo + "PULSE — SMART LINK"), embutido como data URI.
const LOGO_FULL_DATA_URI = `data:image/png;base64,${readFileSync(path.join(process.cwd(), "public/brand/logo-full.png")).toString("base64")}`;

/** Open Graph / Twitter Card dinâmico (Fase 10) — mesmo `DomainResolver`
 * do favicon. Um link para a página de login/cadastro de uma empresa
 * white-label, compartilhado no WhatsApp/LinkedIn/etc., mostra o preview
 * com a marca dela, não a do produto genérico. */
export async function GET(req: NextRequest) {
  const brand = await resolveBrandByHost(req.headers.get("host"));
  const colors = buildBrandColorSet(brand?.primaryColor ?? DEFAULT_PRIMARY_COLOR, brand?.secondaryColor);
  const name = brand?.name ?? BRAND.name;
  // Domínio raiz: identidade do produto (preto profundo + violeta). Empresa
  // com marca própria continua 100% com as cores dela.
  const background = brand ? colors.secondary : BRAND.colors.ink;
  const tileBackground = brand ? colors.primary : BRAND.colors.violet;
  const tileColor = brand ? colors.onPrimary : BRAND.colors.ink;
  const nameColor = brand ? colors.primary : BRAND.colors.paper;

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
          background,
        }}
      >
        {brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={name} width={120} height={120} style={{ objectFit: "contain" }} />
        ) : brand ? (
          <div
            style={{
              display: "flex",
              width: 120,
              height: 120,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              background: tileBackground,
              color: tileColor,
              fontSize: 56,
              fontWeight: 700,
              fontFamily: "sans-serif",
            }}
          >
            {name.trim().charAt(0).toUpperCase()}
          </div>
        ) : (
          // Produto sem marca própria por trás: o lockup oficial já traz o
          // nome embutido na imagem — nunca repetir "Pulse" como texto solto
          // embaixo, ver ADR-087.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={LOGO_FULL_DATA_URI} alt={name} width={420} height={297} style={{ objectFit: "contain" }} />
        )}
        {brand ? <span style={{ fontSize: 48, fontWeight: 700, color: nameColor, fontFamily: "sans-serif" }}>{name}</span> : null}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
