"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Copy, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectionIndicator } from "@nfc-os/ui";
import { Canvas } from "./canvas";
import { CampaignTray } from "./campaign-tray";
import { UnplacedTray } from "./unplaced-tray";
import { HeatmapLayerToggle } from "./heatmap-layer-toggle";
import { GhostModePreviewDialog } from "./ghost-mode-preview-dialog";
import { TimeMachinePanel } from "./time-machine-panel";
import { useTimeMachine } from "@/lib/live/use-time-machine";
import { usePlayback } from "@/lib/live/use-playback";
import { computeAllTableStatuses, type TableStatusAssignment } from "@/domain/table-map/status";
import { useLiveConnection } from "@/lib/live/use-live-connection";
import { useHeatmapLayer } from "@/lib/live/use-heatmap-layer";
import type { LiveEvent } from "@/domain/live/types";
import type { HeatmapLayer } from "@/domain/heatmap/types";
import type { DragOverTarget, TableCardItem, TableMapCampaignItem } from "./types";
import type { BranchListItem, ZoneListItem } from "@/types";

interface TableMapViewProps {
  initialCards: TableCardItem[];
  zones: ZoneListItem[];
  branches: BranchListItem[];
  campaigns: TableMapCampaignItem[];
  initialAssignments: TableStatusAssignment[];
  organizationId: string | null;
  canEditLayout: boolean;
  canAssign: boolean;
  /** Prefixo completo (incluindo `/api`) para as rotas de Live Mode/
   * Heatmap/Time Machine — `/api` (o padrão) usa as rotas autenticadas
   * reais do dashboard. O Command Center de demonstração em `/dev/ceo`
   * (sem sessão real) passa `/api/dev/demo` para consumir a mesma lógica
   * de domínio/serviço através de rotas sem exigência de login, escopadas
   * fixas à empresa de demonstração — ver ADR-027. Nunca afeta as rotas de
   * escrita (atribuir campanha), que continuam exigindo autenticação de
   * verdade em ambos os casos. */
  liveApiBase?: string;
  /** Sobrepõe a altura do container raiz — o padrão assume o layout de
   * página inteira do dashboard real (viewport menos o header). Uma tela
   * que incorpora este componente dentro de outro layout (o Command Center
   * em `/dev/ceo`) passa `"h-full"` para caber no espaço que já recebeu. */
  className?: string;
}

const SPECIAL_TABS = new Set(["all", "unzoned"]);

/** Ghost Mode Evolution (Fase 6): uma mudança em massa (zona inteira, empresa
 * inteira, ou um grupo marcado de mesas) espera por confirmação explícita no
 * "Preview Inteligente" antes de ser aplicada — diferente de uma única mesa
 * (baixo risco, aplicada na hora, como na Fase 5). */
type PendingBulkAction =
  | { kind: "cards"; campaign: TableMapCampaignItem; cardIds: string[] }
  | { kind: "zone"; campaign: TableMapCampaignItem; zoneId: string }
  | { kind: "company"; campaign: TableMapCampaignItem };

export function TableMapView({
  initialCards,
  zones,
  campaigns,
  initialAssignments,
  organizationId,
  canEditLayout,
  canAssign,
  liveApiBase = "/api",
  className,
}: TableMapViewProps) {
  const [cards, setCards] = useState(initialCards);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [draggingCampaign, setDraggingCampaign] = useState<TableMapCampaignItem | null>(null);
  const [zoneDragOverId, setZoneDragOverId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [pulseCardIds, setPulseCardIds] = useState<Set<string>>(new Set());
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingBulkAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [timeMachineMinutesAgo, setTimeMachineMinutesAgo] = useState<number | null>(null);

  /** Briefly marks a set of tables as "just assigned" for TableNode's
   * confirming pop animation, then clears itself — a lightweight touch that
   * makes a successful drop feel as satisfying as the drag preview leading
   * up to it (see the Phase 5 report's Product Review notes). */
  const celebrate = useCallback((cardIds: string[]) => {
    if (cardIds.length === 0) return;
    setPulseCardIds(new Set(cardIds));
    setTimeout(() => setPulseCardIds(new Set()), 650);
  }, []);

  /** Sincronização entre abas/dispositivos (Fase 6): uma atribuição em
   * escopo de zona/empresa não tem um `cardId` para pulsar — a resposta
   * correta é buscar de novo o estado real das atribuições, a mesma consulta
   * que já alimenta a carga inicial do mapa (Fase 5), e deixar o
   * `computeAllTableStatuses` recalcular tudo a partir daí. */
  const refetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`${liveApiBase}/table-map/assignments`);
      if (!res.ok) return;
      const data = await res.json();
      setAssignments(data.assignments);
    } catch {
      // Silencioso: o próximo evento ao vivo ou uma atualização manual da
      // página corrige o estado — não vale interromper o gerente por isso.
    }
  }, [liveApiBase]);

  const handleLiveEvent = useCallback(
    (event: LiveEvent) => {
      if (event.cardId) {
        celebrate([event.cardId]);
      } else if (event.kind === "ASSIGNMENT_CHANGED") {
        refetchAssignments();
      }
    },
    [celebrate, refetchAssignments]
  );

  const { status: liveStatus } = useLiveConnection({ enabled: liveEnabled, onEvent: handleLiveEvent, apiBase: liveApiBase });
  const { layer: heatmapLayer, setLayer: setHeatmapLayerRaw, intensities: fetchedHeatmapIntensities, trends: heatmapTrends } = useHeatmapLayer(liveApiBase);

  const timeMachineAt = useMemo(
    () => (timeMachineMinutesAgo !== null ? new Date(Date.now() - timeMachineMinutesAgo * 60_000) : null),
    [timeMachineMinutesAgo]
  );
  const { statusMap: historicalStatusMap, summary: timeMachineSummary, loading: timeMachineLoading } = useTimeMachine(timeMachineAt, liveApiBase);
  const { playing: playbackPlaying, progress: playbackProgress, play: playPlayback, stop: stopPlayback } = usePlayback(handleLiveEvent, liveApiBase);

  // Time Machine e Heatmap respondem à mesma pergunta visual ("o que essa
  // mesa está mostrando agora?") de duas formas incompatíveis — olhar para
  // trás no tempo vs. olhar para uma intensidade agregada. Ativar um
  // desliga o outro, para nunca sobrepor dois significados de cor na
  // mesma mesa ao mesmo tempo.
  const setHeatmapLayer = useCallback(
    (layer: HeatmapLayer | null) => {
      if (layer) setTimeMachineMinutesAgo(null);
      setHeatmapLayerRaw(layer);
    },
    [setHeatmapLayerRaw]
  );
  const setTimeMachineMinutesAgoGuarded = useCallback(
    (minutes: number | null) => {
      if (minutes !== null) setHeatmapLayerRaw(null);
      setTimeMachineMinutesAgo(minutes);
    },
    [setHeatmapLayerRaw]
  );

  const positionedCards = useMemo(() => cards.filter((c) => c.layoutX !== null && c.layoutY !== null), [cards]);
  const unplacedCards = useMemo(() => cards.filter((c) => c.layoutX === null), [cards]);

  const zoneTabs = useMemo(() => {
    const tabs = [{ id: "all", label: "Todas" }, ...zones.map((z) => ({ id: z.id, label: z.name }))];
    if (positionedCards.some((c) => c.zoneId === null)) tabs.push({ id: "unzoned", label: "Sem zona" });
    return tabs;
  }, [zones, positionedCards]);

  const visibleCards = useMemo(() => {
    if (activeTab === "all") return positionedCards;
    if (activeTab === "unzoned") return positionedCards.filter((c) => c.zoneId === null);
    return positionedCards.filter((c) => c.zoneId === activeTab);
  }, [positionedCards, activeTab]);

  const statusMap = useMemo(
    () => computeAllTableStatuses(visibleCards, assignments, organizationId),
    [visibleCards, assignments, organizationId]
  );

  /** A camada "Campanha atual" não tem sua própria agregação (ver
   * domain/heatmap/types.ts) — é só o `statusMap` que a Fase 5 já calcula,
   * pintado como heatmap (mesa com campanha vencendo = intensidade máxima)
   * em vez da cor por tipo de destino. Nenhuma lógica nova, só composição. */
  const heatmapIntensities = useMemo(() => {
    if (!heatmapLayer) return null;
    if (heatmapLayer === "CURRENT_CAMPAIGN") {
      const map = new Map<string, number>();
      statusMap.forEach((status, cardId) => map.set(cardId, status ? 1 : 0));
      return map;
    }
    return fetchedHeatmapIntensities;
  }, [heatmapLayer, statusMap, fetchedHeatmapIntensities]);

  /** Enquanto o Time Machine está ativo, o mapa mostra o status histórico
   * reconstruído em vez do status ao vivo — mesma forma (`Map<string,
   * TableStatus | null>`), então `Canvas`/`TableNode` não precisam saber a
   * diferença (ver time-machine-panel.tsx). */
  const effectiveStatusMap = timeMachineAt ? historicalStatusMap : statusMap;

  const activeTabLabel = zoneTabs.find((t) => t.id === activeTab)?.label ?? "Todas";
  const ghostAllVisible = zoneDragOverId === "all" || (zoneDragOverId === activeTab && !SPECIAL_TABS.has(activeTab));

  const pendingAffected = useMemo(() => {
    if (!pendingAction) return { cardIds: [] as string[], names: [] as string[], scopeLabel: "" };
    if (pendingAction.kind === "cards") {
      const set = new Set(pendingAction.cardIds);
      const affected = cards.filter((c) => set.has(c.id));
      return {
        cardIds: pendingAction.cardIds,
        names: affected.map((c) => c.name),
        scopeLabel: `${pendingAction.cardIds.length} mesa(s) selecionada(s)`,
      };
    }
    if (pendingAction.kind === "zone") {
      const affected = positionedCards.filter((c) => c.zoneId === pendingAction.zoneId);
      const zoneName = zoneTabs.find((t) => t.id === pendingAction.zoneId)?.label ?? "esta zona";
      return { cardIds: affected.map((c) => c.id), names: affected.map((c) => c.name), scopeLabel: `toda a zona "${zoneName}"` };
    }
    return { cardIds: positionedCards.map((c) => c.id), names: positionedCards.map((c) => c.name), scopeLabel: "toda a empresa" };
  }, [pendingAction, cards, positionedCards, zoneTabs]);

  function addOptimisticAssignment(campaign: TableMapCampaignItem, extra: Partial<TableStatusAssignment>) {
    setAssignments((prev) => [
      ...prev,
      {
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignType: campaign.type,
        priority: campaign.priority,
        scope: "CARD",
        organizationId: null,
        branchId: null,
        zoneId: null,
        cardId: null,
        createdAt: Date.now(),
        ...extra,
      },
    ]);
  }

  async function handleRenameCommit(id: string, name: string) {
    setRenamingId(null);
    const previous = cards.find((c) => c.id === id)?.name;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    if (name === previous) return;
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Não foi possível renomear a mesa");
    }
  }

  async function handleMoveCommit(moves: { id: string; x: number; y: number }[]) {
    setCards((prev) => prev.map((c) => {
      const m = moves.find((mv) => mv.id === c.id);
      return m ? { ...c, layoutX: m.x, layoutY: m.y } : c;
    }));
    try {
      if (moves.length === 1) {
        const m = moves[0];
        const res = await fetch(`/api/cards/${m.id}/layout`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layoutX: m.x, layoutY: m.y }),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch(`/api/cards/layout`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: moves.map((m) => ({ id: m.id, layoutX: m.x, layoutY: m.y })) }),
        });
        if (!res.ok) throw new Error();
      }
    } catch {
      toast.error("Não foi possível salvar a posição");
    }
  }

  async function handleDuplicateSelected() {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    try {
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/cards/${id}/duplicate`, { method: "POST" }).then((r) => (r.ok ? r.json() : Promise.reject(r))))
      );
      const newCards: TableCardItem[] = results.map((r) => r.card);
      setCards((prev) => [...prev, ...newCards]);
      setSelectedIds(new Set(newCards.map((c) => c.id)));
      toast.success(newCards.length === 1 ? "Mesa duplicada" : `${newCards.length} mesas duplicadas`);
    } catch {
      toast.error("Não foi possível duplicar uma ou mais mesas");
    }
  }

  async function handlePlaceArmed(point: { x: number; y: number }) {
    if (!armedId) return;
    const id = armedId;
    const zoneIdToSet = !SPECIAL_TABS.has(activeTab) ? activeTab : null;
    setArmedId(null);
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, layoutX: point.x, layoutY: point.y, ...(zoneIdToSet ? { zoneId: zoneIdToSet } : {}) } : c)));
    try {
      const res = await fetch(`/api/cards/${id}/layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutX: point.x, layoutY: point.y }),
      });
      if (!res.ok) throw new Error();
      if (zoneIdToSet) {
        const res2 = await fetch(`/api/cards/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zoneId: zoneIdToSet }),
        });
        if (!res2.ok) throw new Error();
      }
      toast.success("Mesa posicionada no mapa");
    } catch {
      toast.error("Não foi possível posicionar a mesa");
    }
  }

  /** Só a mesa única fica com o comportamento instantâneo da Fase 5 — baixo
   * risco (uma mesa por vez), sem necessidade do Preview Inteligente. Grupos
   * de mesas, zonas e a empresa inteira passam por `pendingAction` primeiro
   * (ver handleDropCampaignTarget/handleDropOnTab abaixo). */
  async function handleDropCampaignTarget(target: DragOverTarget) {
    const campaign = draggingCampaign;
    setDraggingCampaign(null);
    if (!campaign) return;

    if (target.kind === "cards") {
      setPendingAction({ kind: "cards", campaign, cardIds: target.cardIds });
      return;
    }
    if (target.kind !== "card") return;

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "CARD", cardId: target.cardId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error);
      }
      const { assignment } = await res.json();
      addOptimisticAssignment(campaign, { scope: "CARD", cardId: target.cardId });
      celebrate([target.cardId]);
      toast.success(`"${campaign.name}" atribuída à mesa`, {
        action: {
          label: "Desfazer",
          onClick: () => undoSingleAssignment(campaign.id, assignment.id),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Não foi possível atribuir a campanha");
    }
  }

  function handleDropOnTab(tabId: string) {
    const campaign = draggingCampaign;
    setDraggingCampaign(null);
    setZoneDragOverId(null);
    if (!campaign || tabId === "unzoned") return;
    setPendingAction(tabId === "all" ? { kind: "company", campaign } : { kind: "zone", campaign, zoneId: tabId });
  }

  async function undoSingleAssignment(campaignId: string, assignmentId: string) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assignments/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await refetchAssignments();
      toast.success("Atribuição desfeita");
    } catch {
      toast.error("Não foi possível desfazer");
    }
  }

  async function undoBulkAssignmentIds(campaignId: string, assignmentIds: string[]) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assignments/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentIds }),
      });
      if (!res.ok) throw new Error();
      await refetchAssignments();
      toast.success("Atribuições desfeitas");
    } catch {
      toast.error("Não foi possível desfazer");
    }
  }

  function cancelPendingAction() {
    setPendingAction(null);
  }

  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action) return;
    setConfirming(true);
    try {
      if (action.kind === "cards") {
        const res = await fetch(`/api/campaigns/${action.campaign.id}/assignments/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardIds: action.cardIds }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error);
        }
        const result: { created: number; skipped: number; assignmentIds: string[] } = await res.json();
        const alreadyAssigned = new Set(
          assignments.filter((a) => a.campaignId === action.campaign.id && a.scope === "CARD").map((a) => a.cardId)
        );
        for (const cardId of action.cardIds) {
          if (!alreadyAssigned.has(cardId)) addOptimisticAssignment(action.campaign, { scope: "CARD", cardId });
        }
        celebrate(action.cardIds);
        toast.success(
          `"${action.campaign.name}" atribuída a ${result.created} mesa(s)` +
            (result.skipped ? ` — ${result.skipped} já tinham essa campanha` : ""),
          result.assignmentIds.length > 0
            ? { action: { label: "Desfazer", onClick: () => undoBulkAssignmentIds(action.campaign.id, result.assignmentIds) } }
            : undefined
        );
      } else {
        const tabId = action.kind === "zone" ? action.zoneId : "all";
        const body = action.kind === "company" ? { scope: "COMPANY" } : { scope: "ZONE", zoneId: action.zoneId };
        const res = await fetch(`/api/campaigns/${action.campaign.id}/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error);
        }
        const { assignment } = await res.json();
        addOptimisticAssignment(action.campaign, action.kind === "company" ? { scope: "COMPANY" } : { scope: "ZONE", zoneId: action.zoneId });
        if (tabId === "all" || tabId === activeTab) celebrate(visibleCards.map((c) => c.id));
        toast.success(`"${action.campaign.name}" atribuída a ${action.kind === "company" ? "toda a empresa" : "toda a zona"}`, {
          action: { label: "Desfazer", onClick: () => undoSingleAssignment(action.campaign.id, assignment.id) },
        });
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Não foi possível atribuir a campanha");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className={cn("flex h-[calc(100vh-2rem)] flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <LayoutGrid className="size-5" /> Mapa de Mesas
          </h1>
          <p className="text-sm text-muted-foreground">Arraste, agrupe por zona e aplique campanhas visualmente — sem regravar nenhum cartão.</p>
        </div>
        <div className="flex items-center gap-4">
          {selectedIds.size > 0 && canEditLayout ? (
            <Button variant="outline" size="sm" onClick={handleDuplicateSelected}>
              <Copy className="size-3.5" /> Duplicar ({selectedIds.size})
            </Button>
          ) : null}
          <HeatmapLayerToggle value={heatmapLayer} onChange={setHeatmapLayer} />
          <TimeMachinePanel
            minutesAgo={timeMachineMinutesAgo}
            onMinutesAgoChange={setTimeMachineMinutesAgoGuarded}
            summary={timeMachineSummary}
            loading={timeMachineLoading}
            playing={playbackPlaying}
            playbackProgress={playbackProgress}
            onPlay={() => playPlayback(30)}
            onStopPlayback={stopPlayback}
          />
          <div className="flex items-center gap-2">
            <Switch id="live" checked={liveEnabled} onCheckedChange={setLiveEnabled} size="sm" />
            <Label htmlFor="live" className="text-xs text-muted-foreground">
              Live Mode
            </Label>
            <ConnectionIndicator status={liveStatus} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="snap" checked={snapEnabled} onCheckedChange={setSnapEnabled} size="sm" />
            <Label htmlFor="snap" className="text-xs text-muted-foreground">
              Grade
            </Label>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); }}>
        <TabsList>
          {zoneTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={zoneDragOverId === tab.id ? "ring-2 ring-primary" : undefined}
              onDragOver={(e) => {
                if (canAssign && draggingCampaign) e.preventDefault();
              }}
              onDragEnter={() => {
                if (canAssign && draggingCampaign) setZoneDragOverId(tab.id);
              }}
              onDragLeave={() => setZoneDragOverId((cur) => (cur === tab.id ? null : cur))}
              onDrop={(e) => {
                if (!canAssign || !draggingCampaign) return;
                e.preventDefault();
                handleDropOnTab(tab.id);
              }}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <UnplacedTray cards={unplacedCards} armedId={armedId} onToggleArm={(id) => setArmedId((cur) => (cur === id ? null : id))} />

      <div className="flex flex-1 overflow-hidden rounded-lg border">
        <Canvas
          cards={visibleCards}
          statusMap={effectiveStatusMap}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          renamingId={renamingId}
          onStartRename={setRenamingId}
          onRenameCommit={handleRenameCommit}
          onRenameCancel={() => setRenamingId(null)}
          onMoveCommit={handleMoveCommit}
          draggingCampaign={draggingCampaign}
          onDropCampaignTarget={handleDropCampaignTarget}
          canEdit={canEditLayout}
          canAssign={canAssign}
          pulseCardIds={pulseCardIds}
          heatmapIntensities={heatmapIntensities}
          heatmapTrends={heatmapTrends}
          snapEnabled={snapEnabled}
          zoneLabel={activeTabLabel}
          armedCardId={armedId}
          onPlaceArmed={handlePlaceArmed}
          ghostAllVisible={ghostAllVisible}
        />
        <CampaignTray
          campaigns={campaigns}
          canAssign={canAssign}
          onDragStart={setDraggingCampaign}
          onDragEnd={() => {
            setDraggingCampaign(null);
            setZoneDragOverId(null);
          }}
        />
      </div>

      <GhostModePreviewDialog
        open={pendingAction !== null}
        campaignName={pendingAction?.campaign.name ?? ""}
        scopeLabel={pendingAffected.scopeLabel}
        affectedCardIds={pendingAffected.cardIds}
        affectedNames={pendingAffected.names}
        onConfirm={confirmPendingAction}
        onCancel={cancelPendingAction}
        confirming={confirming}
        apiBase={liveApiBase}
      />
    </div>
  );
}
