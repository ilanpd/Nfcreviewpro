"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readableTextColor } from "@/domain/white-label/color";

interface PreviewProps {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  loginHeadline: string | null;
  loginBackgroundUrl: string | null;
  qrPreviewUrl: string | null;
}

function LogoOrInitial({ logoUrl, companyName, primaryColor, size = 32 }: { logoUrl: string | null; companyName: string; primaryColor: string; size?: number }) {
  const onPrimary = readableTextColor(primaryColor);
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={companyName} style={{ height: size, maxWidth: size * 3 }} className="object-contain" />;
  }
  return (
    <div
      style={{ width: size, height: size, backgroundColor: primaryColor, color: onPrimary }}
      className="flex shrink-0 items-center justify-center rounded-lg text-sm font-bold"
    >
      {companyName.trim().charAt(0).toUpperCase()}
    </div>
  );
}

/** Mockup do dashboard — uma miniatura ilustrada da barra lateral + cabeçalho
 * reais, tingida com a marca em rascunho (não precisa navegar até o
 * dashboard de verdade para ver o efeito de uma cor). */
function DashboardMockup({ companyName, logoUrl, primaryColor }: PreviewProps) {
  const onPrimary = readableTextColor(primaryColor);
  return (
    <div className="brand-glow overflow-hidden rounded-xl border border-border shadow-sm">
      <div className="flex h-64">
        <div className="flex w-16 flex-col items-center gap-3 border-r border-border bg-muted/40 py-3">
          <LogoOrInitial logoUrl={logoUrl} companyName={companyName} primaryColor={primaryColor} size={28} />
          {["a", "b", "c", "d"].map((k, i) => (
            <div key={k} className="h-2 w-8 rounded" style={{ backgroundColor: i === 0 ? primaryColor : "var(--border)" }} />
          ))}
        </div>
        <div className="flex-1 bg-white p-3">
          <div className="mb-3 flex items-center justify-between rounded-md px-2 py-1.5" style={{ backgroundColor: primaryColor }}>
            <span className="text-xs font-medium" style={{ color: onPrimary }}>
              {companyName}
            </span>
            <div className="size-4 rounded-full" style={{ backgroundColor: onPrimary, opacity: 0.5 }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-md border border-border p-2">
                <div className="h-1.5 w-10 rounded bg-muted" />
                <div className="mt-2 h-4 w-14 rounded" style={{ backgroundColor: i === 0 ? primaryColor : "var(--border)", opacity: i === 0 ? 1 : 0.6 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginMockup({ companyName, logoUrl, primaryColor, secondaryColor, loginHeadline, loginBackgroundUrl }: PreviewProps) {
  return (
    <div
      className="brand-glow flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-border p-6 text-center"
      style={{
        backgroundColor: secondaryColor,
        backgroundImage: loginBackgroundUrl ? `url(${loginBackgroundUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <LogoOrInitial logoUrl={logoUrl} companyName={companyName} primaryColor={primaryColor} size={40} />
      {loginHeadline && <p className="max-w-[220px] text-xs text-muted-foreground">{loginHeadline}</p>}
      <div className="w-full max-w-[200px] space-y-2 rounded-lg border border-border bg-white/90 p-3 shadow-sm">
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-6 w-full rounded" style={{ backgroundColor: primaryColor }} />
      </div>
    </div>
  );
}

function QrMockup({ qrPreviewUrl, companyName, primaryColor }: PreviewProps) {
  return (
    <div className="brand-glow flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-white p-6">
      {qrPreviewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrPreviewUrl} alt="QR de exemplo" className="size-40 object-contain" />
      ) : (
        <div className="flex size-40 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">Gerando…</div>
      )}
      <p className="text-xs font-medium" style={{ color: primaryColor }}>
        {companyName}
      </p>
    </div>
  );
}

/** Cenas físicas ilustradas em 2D — nunca renders 3D fotorrealistas (fora do
 * escopo desta fase, ver ADR-044): formas/gradientes CSS compondo o
 * QR/logo reais sobre uma superfície estilizada, suficiente para o
 * empresário visualizar a composição antes de imprimir. */
function PhysicalScene({
  label,
  sceneClassName,
  children,
}: {
  label: string;
  sceneClassName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative flex h-40 w-full items-center justify-center overflow-hidden rounded-lg ${sceneClassName}`}>{children}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function StickerChip({ qrPreviewUrl, companyName, primaryColor, size = 72 }: PreviewProps & { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md bg-white p-1.5 shadow-md" style={{ width: size + 12 }}>
      {qrPreviewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrPreviewUrl} alt="" style={{ width: size, height: size }} className="object-contain" />
      ) : (
        <div style={{ width: size, height: size }} className="rounded bg-muted" />
      )}
      <span className="text-[7px] font-semibold" style={{ color: primaryColor }}>
        {companyName}
      </span>
    </div>
  );
}

function PhysicalMockups(props: PreviewProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <PhysicalScene label="Mesa" sceneClassName="bg-gradient-to-br from-amber-800 to-amber-950">
        <div className="rotate-[-6deg]">
          <StickerChip {...props} size={56} />
        </div>
      </PhysicalScene>

      <PhysicalScene label="Balcão" sceneClassName="bg-gradient-to-b from-neutral-200 to-neutral-400">
        <div className="absolute bottom-3">
          <StickerChip {...props} size={56} />
        </div>
      </PhysicalScene>

      <PhysicalScene label="Vitrine" sceneClassName="bg-gradient-to-br from-sky-100 to-sky-300 backdrop-blur-sm">
        <div className="border-2 border-white/60">
          <StickerChip {...props} size={56} />
        </div>
      </PhysicalScene>

      <PhysicalScene label="Porta" sceneClassName="bg-gradient-to-b from-stone-600 to-stone-800">
        <StickerChip {...props} size={56} />
      </PhysicalScene>

      <PhysicalScene label="Quarto (porta-cartão)" sceneClassName="bg-gradient-to-br from-neutral-800 to-neutral-950">
        <div
          className="flex h-16 w-24 items-center justify-center rounded-md shadow-lg"
          style={{ background: `linear-gradient(135deg, ${props.primaryColor}, ${props.secondaryColor})` }}
        >
          {props.qrPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.qrPreviewUrl} alt="" className="size-10 rounded bg-white p-0.5" />
          )}
        </div>
      </PhysicalScene>

      <PhysicalScene label="Cartão PVC" sceneClassName="bg-gradient-to-br from-neutral-100 to-neutral-300">
        <div
          className="flex h-16 w-28 items-center justify-between rounded-lg px-2 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${props.primaryColor}, ${props.secondaryColor})` }}
        >
          <LogoOrInitial logoUrl={props.logoUrl} companyName={props.companyName} primaryColor={props.primaryColor} size={20} />
          {props.qrPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.qrPreviewUrl} alt="" className="size-10 rounded bg-white p-0.5" />
          )}
        </div>
      </PhysicalScene>
    </div>
  );
}

/**
 * Preview em Tempo Real (Fase 10) — o painel mais importante do Theme
 * Studio: alterar cor/logo muda TUDO aqui instantaneamente, sem salvar
 * primeiro (ver `theme-studio-view.tsx`'s `draft`). Cinco abas cobrem
 * exatamente o que foi pedido: dashboard, login, QR, e os 6 mockups
 * físicos agrupados numa aba (mesa/balcão/vitrine/porta/quarto/cartão).
 */
export function BrandPreviewPanels(props: PreviewProps) {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="lg:sticky lg:top-6 lg:self-start">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="qr">QR Code</TabsTrigger>
          <TabsTrigger value="physical">Mockups físicos</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="space-y-2">
          <DashboardMockup {...props} />
          <p className="text-xs text-muted-foreground">
            Ilustrativo — o painel interno do NFC OS mantém a mesma aparência para todas as empresas. O que muda de
            verdade ao salvar são as telas que seus clientes veem: Login, QR Code e Impressão.
          </p>
        </TabsContent>
        <TabsContent value="login">
          <LoginMockup {...props} />
        </TabsContent>
        <TabsContent value="qr">
          <QrMockup {...props} />
        </TabsContent>
        <TabsContent value="physical">
          <PhysicalMockups {...props} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
