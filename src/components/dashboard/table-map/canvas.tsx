"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { clampZoom, normalizeRect, rectsIntersect, screenToWorld, snapPointToGrid, snapToGrid, type Rect } from "@/domain/table-map/geometry";
import { TableNode } from "./table-node";
import type { DragOverTarget, GhostPreview, StatusMap, TableCardItem, TableMapCampaignItem } from "./types";

const GRID_SIZE = 20;
const CLICK_THRESHOLD = 4;
const CULL_MARGIN = 200;

const MemoTableNode = memo(TableNode);

interface CanvasProps {
  cards: TableCardItem[];
  statusMap: StatusMap;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  renamingId: string | null;
  onStartRename: (id: string) => void;
  onRenameCommit: (id: string, name: string) => void;
  onRenameCancel: () => void;
  onMoveCommit: (moves: { id: string; x: number; y: number }[]) => void;
  draggingCampaign: TableMapCampaignItem | null;
  onDropCampaignTarget: (target: DragOverTarget) => void;
  canEdit: boolean;
  canAssign: boolean;
  snapEnabled: boolean;
  zoneLabel: string;
  /** Non-null while an unplaced table is "armed" from the tray above the
   * canvas — the next plain click on empty background places it there. */
  armedCardId: string | null;
  onPlaceArmed: (point: { x: number; y: number }) => void;
  /** True while a campaign is being dragged over the currently-active zone
   * tab (or "Todas") — every currently-rendered table previews the tint,
   * not just the one under the cursor. See table-map-view.tsx. */
  ghostAllVisible: boolean;
  /** Tables that just received a new assignment — see TableNode's
   * `justAssigned` for the confirming "pop" animation. */
  pulseCardIds: Set<string>;
  /** Non-null while a Heatmap layer (Fase 6) is selected — overrides each
   * table's status coloring with an intensity-based tint. `null` means
   * "Status mode", the unchanged Fase 5 behavior. */
  heatmapIntensities: Map<string, number> | null;
  /** Heatmap Preditivo (Fase 11) — tendência por mesa ("aquecendo"/
   * "esfriando"/"estável") derivada de comparar a janela atual com a
   * anterior (ver `lib/live/use-heatmap-layer.ts`). `null`/mapa vazio
   * quando não aplicável (fora do modo heatmap, ou camadas que não
   * comparam janela como LAST_INTERACTION/CURRENT_CAMPAIGN). */
  heatmapTrends?: Map<string, "aquecendo" | "esfriando" | "estável"> | null;
}

export function Canvas({
  cards,
  statusMap,
  selectedIds,
  onSelectionChange,
  renamingId,
  onStartRename,
  onRenameCommit,
  onRenameCancel,
  onMoveCommit,
  draggingCampaign,
  onDropCampaignTarget,
  canEdit,
  canAssign,
  pulseCardIds,
  heatmapIntensities,
  heatmapTrends,
  snapEnabled,
  zoneLabel,
  armedCardId,
  onPlaceArmed,
  ghostAllVisible,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);
  const [livePositions, setLivePositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const dragRef = useRef<{
    mode: "move" | "marquee";
    pointerId: number;
    startScreen: { x: number; y: number };
    startWorld: { x: number; y: number };
    moved: boolean;
    originals: Map<string, { x: number; y: number }>;
  } | null>(null);

  // Coalesces every pointermove in a frame into a single state update — a
  // fast mouse/trackpad can fire pointermove far more often than the
  // display refreshes, and each one otherwise triggers its own React
  // commit. This is what keeps a many-hundred-table board responsive during
  // a drag (see the Phase 5 report's performance notes).
  const rafIdRef = useRef<number | null>(null);
  const pendingRef = useRef<{ marquee?: Rect | null; move?: Map<string, { x: number; y: number }> }>({});

  function scheduleFrame() {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if ("marquee" in pendingRef.current) setMarqueeRect(pendingRef.current.marquee ?? null);
      if ("move" in pendingRef.current) setLivePositions(pendingRef.current.move ?? null);
      pendingRef.current = {};
    });
  }

  /** Called from pointerup: the very last pointermove's update may still be
   * sitting in pendingRef, not yet flushed to state (rAF hasn't fired this
   * frame) — read it directly instead of relying on state, then cancel the
   * now-redundant scheduled flush. Whenever this result actually matters
   * (`drag.moved === true`), handlePointerMove fired at least once this
   * gesture, so pendingRef always has a fresher value than component state
   * by this point — there's no case worth falling back to state for. */
  function flushPending() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const marquee = pendingRef.current.marquee ?? null;
    const move = pendingRef.current.move ?? null;
    pendingRef.current = {};
    return { marquee, move };
  }

  const gridSize = snapEnabled ? GRID_SIZE : 0;

  function getContainerPoint(e: { clientX: number; clientY: number }) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const screenPoint = getContainerPoint(e);
      const worldPoint = screenToWorld(screenPoint, pan, zoom);
      dragRef.current = { mode: "marquee", pointerId: e.pointerId, startScreen: screenPoint, startWorld: worldPoint, moved: false, originals: new Map() };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pan, zoom]
  );

  const handleTablePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, cardId: string) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const screenPoint = getContainerPoint(e);
      const worldPoint = screenToWorld(screenPoint, pan, zoom);

      let nextSelection = selectedIds;
      if (e.shiftKey) {
        nextSelection = new Set(selectedIds);
        if (nextSelection.has(cardId)) nextSelection.delete(cardId);
        else nextSelection.add(cardId);
        onSelectionChange(nextSelection);
      } else if (!selectedIds.has(cardId)) {
        nextSelection = new Set([cardId]);
        onSelectionChange(nextSelection);
      }

      // Selection always updates (a Marketing-only user with no card:write
      // still needs to multi-select tables to batch-drop a campaign onto
      // them) — but move-dragging itself is a card:write action, so a
      // non-editor's click never starts a drag (no pointer capture, no
      // livePositions), which avoids a table visually dragging and then
      // snapping back with no explanation once the up-handler refuses to
      // persist it. See RELATORIO_FASE_5.md's Architect Review notes.
      if (!canEdit) return;

      const idsToMove = nextSelection.has(cardId) ? nextSelection : new Set([cardId]);
      const originals = new Map<string, { x: number; y: number }>();
      for (const c of cards) {
        if (idsToMove.has(c.id)) originals.set(c.id, { x: c.layoutX ?? 0, y: c.layoutY ?? 0 });
      }

      dragRef.current = { mode: "move", pointerId: e.pointerId, startScreen: screenPoint, startWorld: worldPoint, moved: false, originals };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pan, zoom, selectedIds, onSelectionChange, cards, canEdit]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const screenPoint = getContainerPoint(e);
      const dxScreen = screenPoint.x - drag.startScreen.x;
      const dyScreen = screenPoint.y - drag.startScreen.y;
      if (Math.abs(dxScreen) > CLICK_THRESHOLD || Math.abs(dyScreen) > CLICK_THRESHOLD) drag.moved = true;

      if (drag.mode === "marquee") {
        const worldPoint = screenToWorld(screenPoint, pan, zoom);
        pendingRef.current.marquee = normalizeRect(drag.startWorld, worldPoint);
        scheduleFrame();
        return;
      }

      // move: delta in world units (screen delta / zoom), applied to each
      // dragged card's own original position — snapped as a group so
      // relative spacing between multi-selected tables is preserved.
      const dxWorld = dxScreen / zoom;
      const dyWorld = dyScreen / zoom;
      const next = new Map<string, { x: number; y: number }>();
      drag.originals.forEach((orig, id) => {
        next.set(id, { x: snapToGrid(orig.x + dxWorld, gridSize), y: snapToGrid(orig.y + dyWorld, gridSize) });
      });
      pendingRef.current.move = next;
      scheduleFrame();
    },
    [pan, zoom, gridSize]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(drag.pointerId);
      } catch {
        // pointer capture may already be released — harmless
      }

      const { marquee: finalMarquee, move: finalMove } = flushPending();

      if (drag.mode === "marquee") {
        if (!drag.moved && armedCardId) {
          onPlaceArmed(snapPointToGrid(drag.startWorld, gridSize));
        } else if (drag.moved && finalMarquee) {
          const hits = cards.filter((c) =>
            rectsIntersect(finalMarquee, { x: c.layoutX ?? 0, y: c.layoutY ?? 0, width: c.layoutWidth, height: c.layoutHeight })
          );
          onSelectionChange(new Set(hits.map((c) => c.id)));
        } else if (!e.shiftKey) {
          onSelectionChange(new Set());
        }
        setMarqueeRect(null);
        return;
      }

      // move
      if (drag.moved && finalMove && canEdit) {
        const moves = Array.from(finalMove.entries()).map(([id, pos]) => ({ id, x: pos.x, y: pos.y }));
        onMoveCommit(moves);
      }
      setLivePositions(null);
    },
    [cards, onSelectionChange, onMoveCommit, canEdit, armedCardId, onPlaceArmed, gridSize]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.92 : 1.08;
        setZoom((z) => clampZoom(z * factor));
      } else {
        e.preventDefault();
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    },
    []
  );

  const visibleRect: Rect | null = containerRef.current
    ? {
        x: -pan.x / zoom - CULL_MARGIN,
        y: -pan.y / zoom - CULL_MARGIN,
        width: containerRef.current.clientWidth / zoom + CULL_MARGIN * 2,
        height: containerRef.current.clientHeight / zoom + CULL_MARGIN * 2,
      }
    : null;

  const culledCards = useMemo(() => {
    if (!visibleRect) return cards;
    return cards.filter((c) =>
      rectsIntersect(visibleRect, { x: c.layoutX ?? 0, y: c.layoutY ?? 0, width: c.layoutWidth, height: c.layoutHeight })
    );
    // visibleRect changes every render (new object) — intentionally not a
    // dependency; culling is a soft perf optimization, not correctness-
    // critical, so recomputing on every cards/pan/zoom-affecting render is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, pan.x, pan.y, zoom]);

  const ghostTarget: DragOverTarget | null = useMemo(
    () =>
      dragOverCardId
        ? selectedIds.has(dragOverCardId) && selectedIds.size > 1
          ? { kind: "cards", cardIds: [...selectedIds] }
          : { kind: "card", cardId: dragOverCardId }
        : null,
    [dragOverCardId, selectedIds]
  );

  const ghostCardIds = useMemo(() => {
    if (ghostAllVisible) return new Set(culledCards.map((c) => c.id));
    if (!ghostTarget) return new Set<string>();
    if (ghostTarget.kind === "card") return new Set([ghostTarget.cardId]);
    if (ghostTarget.kind === "cards") return new Set(ghostTarget.cardIds);
    return new Set<string>();
  }, [ghostTarget, ghostAllVisible, culledCards]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-muted/30"
      style={{
        backgroundImage: snapEnabled
          ? `linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)`
          : undefined,
        backgroundSize: snapEnabled ? `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px` : undefined,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: armedCardId ? "crosshair" : dragRef.current?.mode === "marquee" ? "crosshair" : "default",
      }}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {armedCardId ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 mx-auto w-fit rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow">
          Clique no mapa para posicionar a mesa
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
        {zoneLabel} · {Math.round(zoom * 100)}%
      </div>

      <div className="absolute left-0 top-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
        {culledCards.map((card) => {
          const live = livePositions?.get(card.id);
          const displayCard = live ? { ...card, layoutX: live.x, layoutY: live.y } : card;
          const ghost: GhostPreview | null =
            draggingCampaign && ghostCardIds.has(card.id)
              ? { target: ghostTarget ?? { kind: "card", cardId: card.id }, campaign: draggingCampaign }
              : null;

          return (
            <MemoTableNode
              key={card.id}
              card={displayCard}
              status={statusMap.get(card.id) ?? null}
              selected={selectedIds.has(card.id)}
              ghost={ghost}
              justAssigned={pulseCardIds.has(card.id)}
              heatmapIntensity={heatmapIntensities?.get(card.id) ?? (heatmapIntensities ? 0 : null)}
              heatmapTrend={heatmapIntensities ? (heatmapTrends?.get(card.id) ?? "estável") : null}
              renaming={renamingId === card.id}
              canEdit={canEdit}
              canAssign={canAssign}
              onPointerDownTable={handleTablePointerDown}
              onDoubleClickLabel={onStartRename}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              onDragEnterCampaign={setDragOverCardId}
              onDragLeaveCampaign={(id) => setDragOverCardId((cur) => (cur === id ? null : cur))}
              onDropCampaign={(id) => {
                const target: DragOverTarget =
                  selectedIds.has(id) && selectedIds.size > 1 ? { kind: "cards", cardIds: [...selectedIds] } : { kind: "card", cardId: id };
                setDragOverCardId(null);
                onDropCampaignTarget(target);
              }}
            />
          );
        })}
      </div>

      {marqueeRect ? (
        <div
          className="pointer-events-none absolute border-2 border-primary bg-primary/10"
          style={{
            left: marqueeRect.x * zoom + pan.x,
            top: marqueeRect.y * zoom + pan.y,
            width: marqueeRect.width * zoom,
            height: marqueeRect.height * zoom,
          }}
        />
      ) : null}

      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-md bg-background/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded hover:bg-muted"
          onClick={() => setZoom((z) => clampZoom(z * 0.9))}
        >
          −
        </button>
        <button
          type="button"
          className="flex h-7 items-center justify-center rounded px-2 text-xs hover:bg-muted"
          onClick={() => {
            setZoom(1);
            setPan({ x: 40, y: 40 });
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded hover:bg-muted"
          onClick={() => setZoom((z) => clampZoom(z * 1.1))}
        >
          +
        </button>
      </div>
    </div>
  );
}
