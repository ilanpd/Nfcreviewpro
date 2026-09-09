"use client";

import { useEffect, useRef, useState } from "react";
import { Users, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DESTINATION_META } from "@/domain/campaign/destination";
import type { TableCardItem } from "@/types";
import type { TableStatus } from "@/domain/table-map/status";
import type { GhostPreview } from "./types";

interface TableNodeProps {
  card: TableCardItem;
  status: TableStatus | null;
  selected: boolean;
  ghost: GhostPreview | null;
  /** Briefly true right after this table receives a new campaign assignment
   * — a short scale "pop" confirming the drop landed, on top of the toast.
   * See table-map-view.tsx's pulseCardIds. */
  justAssigned: boolean;
  /** Intensidade 0-1 de uma camada de Heatmap (Fase 6) ativa para esta mesa,
   * ou `null` quando nenhuma camada está ativa (modo Status normal). Sempre
   * um número (nunca `undefined`) quando uma camada está ativa — mesas sem
   * nenhuma atividade na janela chegam aqui como `0`, não ausentes, para que
   * "frio" seja visualmente distinto de "sem dado". */
  heatmapIntensity: number | null;
  /** Heatmap Preditivo (Fase 11) — "aquecendo"/"esfriando"/"estável",
   * comparando a janela atual com a anterior. `null` fora do modo heatmap. */
  heatmapTrend?: "aquecendo" | "esfriando" | "estável" | null;
  renaming: boolean;
  canEdit: boolean;
  canAssign: boolean;
  onPointerDownTable: (e: React.PointerEvent<HTMLDivElement>, cardId: string) => void;
  onDoubleClickLabel: (cardId: string) => void;
  onRenameCommit: (cardId: string, name: string) => void;
  onRenameCancel: () => void;
  onDragEnterCampaign: (cardId: string) => void;
  onDragLeaveCampaign: (cardId: string) => void;
  onDropCampaign: (cardId: string) => void;
}

/** One table on the canvas. Position/size/rotation are applied as inline
 * styles (not Tailwind classes) since they're per-instance numeric values
 * driven by drag state, not design tokens. Positioning math (x/y as
 * top-left, width/height, rotation around center) matches what
 * card.service.ts persists — no transform math happens anywhere else. */
export function TableNode({
  card,
  status,
  selected,
  ghost,
  justAssigned,
  heatmapIntensity,
  heatmapTrend,
  renaming,
  canEdit,
  canAssign,
  onPointerDownTable,
  onDoubleClickLabel,
  onRenameCommit,
  onRenameCancel,
  onDragEnterCampaign,
  onDragLeaveCampaign,
  onDropCampaign,
}: TableNodeProps) {
  const [nameDraft, setNameDraft] = useState(card.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setNameDraft(card.name);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [renaming, card.name]);

  const statusColor = status ? DESTINATION_META[status.campaignType].color : null;
  const ghostColor = ghost ? DESTINATION_META[ghost.campaign.type].color : null;
  const isDropTarget = ghost !== null;
  const isHeatmapMode = heatmapIntensity !== null;

  // Heatmap ativo: a cor deixa de significar "qual campanha venceu" (status)
  // e passa a significar "quanta intensidade" — a mesma escala de cor da
  // marca usada pelo Heatmap Card genérico do Design System (Fase 4.5), não
  // uma paleta nova, para os dois lugares do produto "falarem a mesma língua
  // visual" de heatmap.
  const heatmapBackground =
    isHeatmapMode && !isDropTarget
      ? heatmapIntensity === 0
        ? "var(--muted)"
        : `color-mix(in oklch, var(--brand) ${Math.round(heatmapIntensity! * 90 + 10)}%, var(--muted))`
      : null;

  return (
    <div
      data-card-id={card.id}
      className="absolute select-none"
      style={{
        left: card.layoutX ?? 0,
        top: card.layoutY ?? 0,
        width: card.layoutWidth,
        height: card.layoutHeight,
        transform: `rotate(${card.layoutRotation}deg)`,
        transformOrigin: "center center",
        touchAction: "none",
      }}
      onPointerDown={(e) => (canEdit || canAssign) && onPointerDownTable(e, card.id)}
      onDragEnter={(e) => {
        if (!canAssign) return;
        e.preventDefault();
        onDragEnterCampaign(card.id);
      }}
      onDragOver={(e) => canAssign && e.preventDefault()}
      onDragLeave={() => canAssign && onDragLeaveCampaign(card.id)}
      onDrop={(e) => {
        if (!canAssign) return;
        e.preventDefault();
        onDropCampaign(card.id);
      }}
    >
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-0.5 border-2 shadow-sm transition-all duration-200 ${
          card.tableShape === "CIRCLE" ? "rounded-full" : "rounded-lg"
        } ${selected ? "border-primary ring-2 ring-primary/40" : "border-transparent"} ${justAssigned ? "scale-110 shadow-lg" : ""} ${
          isHeatmapMode && heatmapTrend === "aquecendo" ? "heatmap-breathe" : ""
        }`}
        style={{
          backgroundColor: isDropTarget
            ? `${ghostColor}33`
            : heatmapBackground ?? (statusColor ? `${statusColor}22` : "var(--muted)"),
          borderColor: isDropTarget
            ? (ghostColor ?? undefined)
            : selected
              ? undefined
              : isHeatmapMode
                ? undefined
                : statusColor
                  ? `${statusColor}55`
                  : undefined,
          boxShadow: justAssigned && statusColor ? `0 0 0 4px ${statusColor}33` : undefined,
        }}
      >
        {!isHeatmapMode && status?.hasConflict ? (
          <div title={`${status.competingCount} campanhas competem por esta mesa`} className="absolute -right-1.5 -top-1.5 rounded-full bg-amber-500 p-0.5 text-white shadow">
            <AlertTriangle className="size-3" />
          </div>
        ) : null}

        {/* Heatmap Preditivo (Fase 11) — o salão "respira": uma mesa
            aquecendo pulsa suavemente (classe `heatmap-breathe`, globals.css)
            e ganha uma seta de tendência; esfriando só ganha a seta, sem
            animação (esfriar não pede a mesma urgência visual). */}
        {isHeatmapMode && heatmapTrend && heatmapTrend !== "estável" ? (
          <div
            title={heatmapTrend === "aquecendo" ? "Aquecendo em relação à janela anterior" : "Esfriando em relação à janela anterior"}
            className={`absolute -right-1.5 -top-1.5 rounded-full p-0.5 text-white shadow ${heatmapTrend === "aquecendo" ? "bg-emerald-500" : "bg-slate-400"}`}
          >
            {heatmapTrend === "aquecendo" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          </div>
        ) : null}

        {renaming ? (
          <Input
            ref={inputRef}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameCommit(card.id, nameDraft.trim() || card.name);
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={() => onRenameCommit(card.id, nameDraft.trim() || card.name)}
            className="h-6 w-[90%] px-1 text-center text-xs"
          />
        ) : (
          <span
            className="max-w-[90%] truncate text-xs font-semibold"
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (canEdit) onDoubleClickLabel(card.id);
            }}
          >
            {card.name}
          </span>
        )}

        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Users className="size-2.5" /> {card.seats}
        </span>

        {isDropTarget ? (
          <span className="absolute -bottom-5 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[10px] font-medium shadow">
            {ghost!.campaign.name}
          </span>
        ) : null}
      </div>
    </div>
  );
}
