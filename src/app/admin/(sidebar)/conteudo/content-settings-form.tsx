"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, Video, Package, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoreProduct } from "@/lib/store-products";

interface OverrideState {
  imageUrl: string;
  unitPriceCents: string;
}

export function ContentSettingsForm({
  initialHeroVideoUrl,
  initialOverrides,
  products,
  initialBlankChipStock,
  initialLowStockThreshold,
}: {
  initialHeroVideoUrl: string;
  initialOverrides: Record<string, { imageUrl?: string; unitPriceCents?: number }>;
  products: StoreProduct[];
  initialBlankChipStock: number;
  initialLowStockThreshold: number;
}) {
  const [heroVideoUrl, setHeroVideoUrl] = useState(initialHeroVideoUrl);
  const [blankChipStock, setBlankChipStock] = useState(String(initialBlankChipStock));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(initialLowStockThreshold));
  const [overrides, setOverrides] = useState<Record<string, OverrideState>>(() => {
    const initial: Record<string, OverrideState> = {};
    for (const product of products) {
      const o = initialOverrides[product.id];
      initial[product.id] = {
        imageUrl: o?.imageUrl ?? "",
        unitPriceCents: o?.unitPriceCents !== undefined ? String(o.unitPriceCents / 100) : "",
      };
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const storeProductOverrides: Record<string, { imageUrl?: string; unitPriceCents?: number }> = {};
      for (const [productId, state] of Object.entries(overrides)) {
        const entry: { imageUrl?: string; unitPriceCents?: number } = {};
        if (state.imageUrl.trim()) entry.imageUrl = state.imageUrl.trim();
        if (state.unitPriceCents.trim()) entry.unitPriceCents = Math.round(parseFloat(state.unitPriceCents) * 100);
        storeProductOverrides[productId] = entry;
      }

      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroVideoUrl,
          storeProductOverrides,
          blankChipStock: Number.parseInt(blankChipStock, 10) || 0,
          lowStockThreshold: Number.parseInt(lowStockThreshold, 10) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível salvar");
      }
      toast.success("Conteúdo do site atualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Video className="size-4" /> Vídeo de apresentação (home)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="hero-video">URL do vídeo (YouTube, Vimeo ou .mp4 direto)</Label>
          <Input
            id="hero-video"
            placeholder="https://..."
            value={heroVideoUrl}
            onChange={(e) => setHeroVideoUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Deixe em branco para manter o placeholder atual (&ldquo;Vídeo demonstrativo em breve&rdquo;).</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Package className="size-4" /> Produtos da loja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {products.map((product) => (
            <div key={product.id} className="grid gap-3 border-b border-border/60 pb-6 last:border-0 last:pb-0 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-sm font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  Preço padrão: {(product.unitPriceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} / cartão
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`img-${product.id}`}>URL da foto</Label>
                <Input
                  id={`img-${product.id}`}
                  placeholder="https://..."
                  value={overrides[product.id]?.imageUrl ?? ""}
                  onChange={(e) => setOverrides((prev) => ({ ...prev, [product.id]: { ...prev[product.id], imageUrl: e.target.value } }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`price-${product.id}`}>Preço por cartão (R$) — deixe em branco para manter o padrão</Label>
                <Input
                  id={`price-${product.id}`}
                  type="number"
                  step="0.01"
                  placeholder={(product.unitPriceCents / 100).toFixed(2)}
                  value={overrides[product.id]?.unitPriceCents ?? ""}
                  onChange={(e) =>
                    setOverrides((prev) => ({ ...prev, [product.id]: { ...prev[product.id], unitPriceCents: e.target.value } }))
                  }
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Boxes className="size-4" /> Estoque de chips NFC em branco
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="blank-chip-stock">Chips disponíveis agora</Label>
            <Input
              id="blank-chip-stock"
              type="number"
              min={0}
              value={blankChipStock}
              onChange={(e) => setBlankChipStock(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Decrementado sozinho a cada pedido provisionado — ajuste aqui quando repuser com o fornecedor.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="low-stock-threshold">Avisar quando ficar abaixo de</Label>
            <Input
              id="low-stock-threshold"
              type="number"
              min={0}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="size-4" /> {saving ? "Salvando…" : "Salvar alterações"}
      </Button>
    </div>
  );
}
