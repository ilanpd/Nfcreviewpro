"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Palette, Save } from "lucide-react";
import { AnalyticsCard } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deriveSecondaryColor, isValidHexColor } from "@/domain/white-label/color";
import { BrandRipple } from "@/components/white-label/brand-ripple";
import { DomainPanel } from "./domain-panel";
import { BrandPreviewPanels } from "./brand-preview-panels";
import { PrintAssetsPanel } from "./print-assets-panel";
import type { Company } from "@/generated/prisma/client";

export interface BrandDraft {
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  secondaryAuto: boolean;
  loginHeadline: string;
  loginBackgroundUrl: string;
}

function draftFromCompany(company: Company): BrandDraft {
  const primaryColor = company.primaryColor;
  const secondaryAuto = !company.secondaryColor;
  return {
    logoUrl: company.logoUrl ?? "",
    faviconUrl: company.faviconUrl ?? "",
    primaryColor,
    secondaryColor: company.secondaryColor ?? deriveSecondaryColor(primaryColor),
    secondaryAuto,
    loginHeadline: company.loginHeadline ?? "",
    loginBackgroundUrl: company.loginBackgroundUrl ?? "",
  };
}

/**
 * Theme Studio (Fase 10) — "Preview em tempo real": nada aqui salva a cada
 * tecla. `draft` vive só no estado local do React; os painéis de preview
 * (`BrandPreviewPanels`) leem `draft`, nunca `company`. Só "Salvar
 * alterações" faz um PATCH de verdade — a mesma separação rascunho/salvo
 * que qualquer editor sério (Figma incluído) usa.
 */
export function ThemeStudioView({
  company,
  cards,
  rootDomain,
}: {
  company: Company;
  cards: { id: string; name: string }[];
  rootDomain: string;
}) {
  const [draft, setDraft] = useState<BrandDraft>(() => draftFromCompany(company));
  const [saving, setSaving] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveSecondary = draft.secondaryAuto ? deriveSecondaryColor(draft.primaryColor) : draft.secondaryColor;

  const refreshQrPreview = useCallback((primaryColor: string, secondaryColor: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/company/branding/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ primaryColor, secondaryColor }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setQrPreviewUrl(data.qrDataUrl);
      } catch {
        // preview best-effort — uma falha aqui nunca deveria travar o resto do Theme Studio
      }
    }, 300);
  }, []);

  useEffect(() => {
    refreshQrPreview(draft.primaryColor, effectiveSecondary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.primaryColor, effectiveSecondary]);

  function update<K extends keyof BrandDraft>(key: K, value: BrandDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!isValidHexColor(draft.primaryColor)) return toast.error("Cor principal inválida.");
    if (!draft.secondaryAuto && !isValidHexColor(draft.secondaryColor)) return toast.error("Cor secundária inválida.");

    setSaving(true);
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: draft.logoUrl,
          faviconUrl: draft.faviconUrl,
          primaryColor: draft.primaryColor,
          secondaryColor: draft.secondaryAuto ? null : draft.secondaryColor,
          loginHeadline: draft.loginHeadline,
          loginBackgroundUrl: draft.loginBackgroundUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível salvar a marca");
      }
      toast.success("Marca salva — vale para dashboard, login, QR e impressão.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Palette className="size-6 text-brand" /> Theme Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Sua identidade completa — dashboard, login, QR e impressão mudam juntos, ao vivo, antes de salvar.
          </p>
        </div>
        <BrandRipple>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        </BrandRipple>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Tabs defaultValue="identity">
            <TabsList>
              <TabsTrigger value="identity">Identidade</TabsTrigger>
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="domain">Domínio</TabsTrigger>
              <TabsTrigger value="print">Impressão</TabsTrigger>
            </TabsList>

            <TabsContent value="identity">
              <AnalyticsCard title="Identidade" description="Logo, favicon e cores — a base de tudo que sua marca toca no produto.">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>URL do logo</Label>
                    <Input placeholder="https://…" value={draft.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>URL do favicon</Label>
                    <Input placeholder="https://…" value={draft.faviconUrl} onChange={(e) => update("faviconUrl", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Sem um favicon próprio, geramos um com a inicial do seu nome na sua cor.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cor principal</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={draft.primaryColor}
                        onChange={(e) => update("primaryColor", e.target.value)}
                        className="size-10 cursor-pointer rounded-md border"
                      />
                      <Input value={draft.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="w-32" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Cor secundária</Label>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline"
                        onClick={() => update("secondaryAuto", !draft.secondaryAuto)}
                      >
                        {draft.secondaryAuto ? "Escolher manualmente" : "Derivar automaticamente"}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={effectiveSecondary}
                        disabled={draft.secondaryAuto}
                        onChange={(e) => update("secondaryColor", e.target.value)}
                        className="size-10 cursor-pointer rounded-md border disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <Input value={effectiveSecondary} disabled className="w-32" />
                    </div>
                    {draft.secondaryAuto && <p className="text-xs text-muted-foreground">Um tom claro derivado da sua cor principal.</p>}
                  </div>
                </div>
              </AnalyticsCard>
            </TabsContent>

            <TabsContent value="login">
              <AnalyticsCard title="Tela de login" description="O que sua equipe vê ao entrar pelo seu domínio/subdomínio próprio.">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Mensagem de boas-vindas</Label>
                    <Input
                      placeholder="ex.: Bem-vindo de volta à Pizzaria Bella"
                      maxLength={120}
                      value={draft.loginHeadline}
                      onChange={(e) => update("loginHeadline", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>URL de fundo (opcional)</Label>
                    <Input
                      placeholder="https://…"
                      value={draft.loginBackgroundUrl}
                      onChange={(e) => update("loginBackgroundUrl", e.target.value)}
                    />
                  </div>
                </div>
              </AnalyticsCard>
            </TabsContent>

            <TabsContent value="domain">
              <DomainPanel company={company} rootDomain={rootDomain} />
            </TabsContent>

            <TabsContent value="print">
              <PrintAssetsPanel cards={cards} />
            </TabsContent>
          </Tabs>
        </div>

        <BrandPreviewPanels
          companyName={company.name}
          logoUrl={draft.logoUrl || null}
          primaryColor={draft.primaryColor}
          secondaryColor={effectiveSecondary}
          loginHeadline={draft.loginHeadline || null}
          loginBackgroundUrl={draft.loginBackgroundUrl || null}
          qrPreviewUrl={qrPreviewUrl}
        />
      </div>
    </main>
  );
}
