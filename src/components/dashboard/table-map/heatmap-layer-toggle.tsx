"use client";

import { Flame } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HEATMAP_LAYER_LABEL, type HeatmapLayer } from "@/domain/heatmap/types";

const LAYER_ORDER: HeatmapLayer[] = [
  "APPROACHES",
  "CONVERSIONS",
  "GOOGLE_REVIEWS",
  "INSTAGRAM",
  "CURRENT_CAMPAIGN",
  "LAST_INTERACTION",
];

const STATUS_VALUE = "STATUS";

interface HeatmapLayerToggleProps {
  value: HeatmapLayer | null;
  onChange: (layer: HeatmapLayer | null) => void;
}

/**
 * Seletor de camada do Heatmap Inteligente (Fase 6). "Status" (o padrão) não
 * é uma camada de heatmap de verdade — é o modo normal do Mapa de Mesas
 * (Fase 5, coloração por campanha vencedora), listado aqui só para ser o
 * jeito de sair de um heatmap e voltar ao normal.
 */
export function HeatmapLayerToggle({ value, onChange }: HeatmapLayerToggleProps) {
  return (
    <Select value={value ?? STATUS_VALUE} onValueChange={(v) => onChange(v === STATUS_VALUE ? null : (v as HeatmapLayer))}>
      <SelectTrigger size="sm" className="w-[180px]">
        <Flame className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={STATUS_VALUE}>Status (padrão)</SelectItem>
        {LAYER_ORDER.map((layer) => (
          <SelectItem key={layer} value={layer}>
            {HEATMAP_LAYER_LABEL[layer]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
