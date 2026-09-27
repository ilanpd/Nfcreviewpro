"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Scan } from "lucide-react";
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
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Alguns navegadores/dispositivos de entrada (touchpad tap-and-drag,
        // certas automações) já consideram o ponteiro "solto" no instante
        // deste pointerdown, lançando NotFoundError aqui — sem o try/catch,
        // essa exceção não tratada interrompia o gesto inteiro (a mesa nem
        // chegava a se mover). O `dragRef` acima já foi setado antes desta
        // chamada, então o drag continua funcionando via bubbling normal do
        // pointermove/pointerup no contêiner, mesmo sem captura explícita.
      }
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
      // dragged card's own original position. Segue o cursor sem encaixar no
      // grid quadro a quadro — encaixar a cada pointermove fazia a mesa
      // "pular" em saltos de GRID_SIZE em vez de acompanhar o mouse, o "bug
      // na grade" reportado ao mexer nas mesas. O encaixe final acontece uma
      // única vez, no pointerup (ver handlePointerUp), igual ao padrão de
      // "arrasta livre, encaixa ao soltar" de outros editores de canvas.
      const dxWorld = dxScreen / zoom;
      const dyWorld = dyScreen / zoom;
      const next = new Map<string, { x: number; y: number }>();
      drag.originals.forEach((orig, id) => {
        next.set(id, { x: orig.x + dxWorld, y: orig.y + dyWorld });
      });
      pendingRef.current.move = next;
      scheduleFrame();
    },
    [pan, zoom]
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

      // Recalcula o deslocamento final direto a partir DESTE evento (soltar
      // o botão), nunca só a partir do que os pointermove intermediários
      // acumularam em pendingRef — um arrasto rápido o bastante pode chegar
      // ao navegador SEM NENHUM pointermove entre o pressionar e o soltar
      // (throttling/coalescing de input do SO ou do navegador; medido
      // acontecendo de verdade em testes automatizados, e a causa mais
      // provável do "às vezes dá pra mover, às vezes não" relatado — não
      // depende de sorte, depende só de o gesto ser rápido demais pro
      // navegador entregar um evento no meio do caminho). Sem isto,
      // `drag.moved` continuava `false` pra sempre e o movimento inteiro
      // era descartado em silêncio, mesmo com o ponteiro claramente tendo
      // saído de um lugar e chegado em outro bem diferente.
      const screenPoint = getContainerPoint(e);
      const dxScreen = screenPoint.x - drag.startScreen.x;
      const dyScreen = screenPoint.y - drag.startScreen.y;
      const movedEnough = drag.moved || Math.abs(dxScreen) > CLICK_THRESHOLD || Math.abs(dyScreen) > CLICK_THRESHOLD;

      const { marquee: finalMarquee } = flushPending();

      if (drag.mode === "marquee") {
        const worldPoint = screenToWorld(screenPoint, pan, zoom);
        const marqueeRectFinal = finalMarquee ?? normalizeRect(drag.startWorld, worldPoint);
        if (!movedEnough && armedCardId) {
          onPlaceArmed(snapPointToGrid(drag.startWorld, gridSize));
        } else if (movedEnough) {
          const hits = cards.filter((c) =>
            rectsIntersect(marqueeRectFinal, { x: c.layoutX ?? 0, y: c.layoutY ?? 0, width: c.layoutWidth, height: c.layoutHeight })
          );
          onSelectionChange(new Set(hits.map((c) => c.id)));
        } else if (!e.shiftKey) {
          onSelectionChange(new Set());
        }
        setMarqueeRect(null);
        return;
      }

      // move — o encaixe no grid acontece aqui, uma vez só, ao soltar (ver
      // handlePointerMove acima para o porquê do arrasto em si ser livre).
      // A posição final vem de `drag.originals` + o delta computado ACIMA
      // (não de `pendingRef.current.move`), pelo mesmo motivo do comentário
      // grande acima: precisa funcionar mesmo com zero pointermove.
      if (movedEnough && canEdit) {
        const dxWorld = dxScreen / zoom;
        const dyWorld = dyScreen / zoom;
        const finalMove = new Map<string, { x: number; y: number }>();
        drag.originals.forEach((orig, id) => {
          finalMove.set(id, { x: orig.x + dxWorld, y: orig.y + dyWorld });
        });
        const moves = Array.from(finalMove.entries()).map(([id, pos]) => ({
          id,
          x: snapToGrid(pos.x, gridSize),
          y: snapToGrid(pos.y, gridSize),
        }));
        onMoveCommit(moves);
      }
      setLivePositions(null);
    },
    [cards, onSelectionChange, onMoveCommit, canEdit, armedCardId, onPlaceArmed, gridSize, pan, zoom]
  );

  /** Muda o zoom mantendo `screenPoint` (em pixels do container) apontando
   * para o MESMO ponto do mundo antes e depois — sem isto, cada "tick" de
   * zoom recentraliza o mapa na origem do mundo (0,0) em vez do cursor,
   * fazendo o quadro inteiro "pular" para longe de onde o usuário está
   * olhando a cada scroll. É a causa raiz de boa parte da navegação "não
   * fluida" reportada, independente do bug de arrastar mesas. */
  const zoomAtPoint = useCallback((factor: number, screenPoint: { x: number; y: number }) => {
    setZoom((z) => {
      const nextZoom = clampZoom(z * factor);
      setPan((p) => ({
        x: screenPoint.x - ((screenPoint.x - p.x) / z) * nextZoom,
        y: screenPoint.y - ((screenPoint.y - p.y) / z) * nextZoom,
      }));
      return nextZoom;
    });
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.92 : 1.08;
        zoomAtPoint(factor, getContainerPoint(e));
      } else {
        e.preventDefault();
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    },
    [zoomAtPoint]
  );

  const FIT_PADDING = 60;
  // Nunca deixa o "enquadrar tudo" encolher as mesas além do confortável pra
  // ler ou clicar — um salão muito espalhado forçaria um zoom minúsculo
  // (mesas de poucos pixels, quase impossíveis de acertar com o mouse) só
  // pra caber tudo de uma vez. Abaixo deste piso, é melhor ver a maior parte
  // do salão com clareza e navegar (arrastar/zoom) até o resto do que ver
  // tudo de uma vez sem dar pra usar nada.
  const FIT_MIN_ZOOM = 0.5;

  /** p-ésimo percentil (0-1) de uma lista JÁ ORDENADA, com interpolação
   * linear entre os dois pontos mais próximos. */
  function percentileOfSorted(sorted: number[], p: number): number {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  /** Enquadra todas as mesas de uma vez (zoom + pan calculados a partir do
   * retângulo que envolve todas elas) — o botão "Ver tudo" abaixo. Sem isto,
   * a única forma de ver o salão inteiro era arrastar manualmente em várias
   * direções (inclusive na horizontal) até cobrir tudo, o que o usuário
   * relatou como "ter que rolar lateralmente pra ver tudo".
   *
   * Usa o percentil 5-95 das bordas de cada mesa, não o mínimo/máximo bruto
   * — encontrado ao vivo numa conta real: UMA mesa só com uma posição
   * absurda (uma coordenada Y de milhares de unidades, quase certamente de
   * um arrasto que deu errado em algum momento) fazia o retângulo "abraçar
   * tudo" ficar gigantesco, o zoom calculado ir a quase zero (só escapando
   * disso pelo piso de zoom), e o pan centralizar num ponto vazio entre a
   * mesa perdida e todas as outras — o mapa inteiro aparecia em branco,
   * mesmo com todas as mesas reais e corretamente posicionadas no banco.
   * Cortar os 5% mais extremos de cada lado torna isso impossível: uma
   * única mesa fora da curva nunca mais consegue esconder todas as outras,
   * ela só fica de fora do enquadramento automático (ainda alcançável
   * arrastando/dando zoom manualmente). */
  const handleFitToView = useCallback(() => {
    if (cards.length === 0 || !containerRef.current) return;
    const lefts = cards.map((c) => c.layoutX ?? 0).sort((a, b) => a - b);
    const tops = cards.map((c) => c.layoutY ?? 0).sort((a, b) => a - b);
    const rights = cards.map((c) => (c.layoutX ?? 0) + c.layoutWidth).sort((a, b) => a - b);
    const bottoms = cards.map((c) => (c.layoutY ?? 0) + c.layoutHeight).sort((a, b) => a - b);
    const minX = percentileOfSorted(lefts, 0.05);
    const minY = percentileOfSorted(tops, 0.05);
    const maxX = percentileOfSorted(rights, 0.95);
    const maxY = percentileOfSorted(bottoms, 0.95);
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const { clientWidth, clientHeight } = containerRef.current;
    const nextZoom = clampZoom(
      Math.max(FIT_MIN_ZOOM, Math.min((clientWidth - FIT_PADDING * 2) / contentWidth, (clientHeight - FIT_PADDING * 2) / contentHeight))
    );
    setZoom(nextZoom);
    setPan({
      x: (clientWidth - contentWidth * nextZoom) / 2 - minX * nextZoom,
      y: (clientHeight - contentHeight * nextZoom) / 2 - minY * nextZoom,
    });
  }, [cards]
  );

  const didFitOnLoadRef = useRef(false);
  useEffect(() => {
    // Enquadra tudo automaticamente na primeira renderização com mesas — o
    // usuário pediu pra ver o salão inteiro "sem precisar clicar em botão
    // nenhum". `didFitOnLoadRef` garante que isso acontece só UMA vez: sem
    // ele, todo arrasto (que também muda `cards`, e portanto a identidade de
    // `handleFitToView`) re-enquadraria a view sozinho, brigando com o pan/
    // zoom manual do usuário no meio de uma edição.
    if (didFitOnLoadRef.current || cards.length === 0 || !containerRef.current) return;
    didFitOnLoadRef.current = true;
    handleFitToView();
  }, [cards, handleFitToView]);

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
              zoom={zoom}
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
        <button type="button" title="Ver tudo" className="flex size-7 items-center justify-center rounded hover:bg-muted" onClick={handleFitToView}>
          <Scan className="size-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded hover:bg-muted"
          onClick={() =>
            zoomAtPoint(0.9, {
              x: (containerRef.current?.clientWidth ?? 0) / 2,
              y: (containerRef.current?.clientHeight ?? 0) / 2,
            })
          }
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
          onClick={() =>
            zoomAtPoint(1.1, {
              x: (containerRef.current?.clientWidth ?? 0) / 2,
              y: (containerRef.current?.clientHeight ?? 0) / 2,
            })
          }
        >
          +
        </button>
      </div>
    </div>
  );
}
