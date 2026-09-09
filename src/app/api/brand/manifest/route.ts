import { NextRequest, NextResponse } from "next/server";
import { resolveBrandByHost } from "@/lib/white-label/resolve-brand";

/**
 * Web App Manifest dinâmico (Fase 10) — preparação para PWA (ver ADR-043:
 * um manifest válido é o pré-requisito de "Adicionar à tela inicial", mas
 * instalabilidade completa de PWA — service worker, offline — não é
 * construída nesta fase, só o manifest em si, como pedido explicitamente
 * ("PWA icons (preparação)"). Resolvido pelo mesmo `DomainResolver`.
 */
export async function GET(req: NextRequest) {
  const brand = await resolveBrandByHost(req.headers.get("host"));
  const name = brand?.name ?? "NFC Review Pro";
  const themeColor = brand?.primaryColor ?? "#0F172A";

  return NextResponse.json(
    {
      name,
      short_name: name,
      description: `Cartões NFC inteligentes — ${name}`,
      start_url: "/dashboard",
      display: "standalone",
      background_color: "#FFFFFF",
      theme_color: themeColor,
      icons: [
        { src: "/api/brand/icon?size=192", sizes: "192x192", type: "image/png" },
        { src: "/api/brand/icon?size=512", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
