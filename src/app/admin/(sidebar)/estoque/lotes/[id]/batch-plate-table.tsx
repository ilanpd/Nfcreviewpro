"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_LABEL, STAGE_ORDER, type PlateStage } from "@/domain/plates/status";
import type { PlateRowDTO } from "@/services/plates.service";
import { DownloadButton } from "../../_components/download-button";
import { PlateDetailSheet } from "../../_components/plate-detail-sheet";
import { StageBadge } from "../../_components/stage-badge";

const tick = (ok: boolean) => (ok ? <span className="text-emerald-600 dark:text-emerald-400">✓</span> : <span className="text-muted-foreground">—</span>);

/** As placas de um lote: filtrar por etapa, selecionar para reimprimir, abrir o detalhe de qualquer uma. */
export function BatchPlateTable({
  batchId,
  plates,
  orderByCard,
}: {
  batchId: string;
  plates: PlateRowDTO[];
  orderByCard: Record<string, { id: string; customerName: string; status: string }>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<PlateStage | "ALL">("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result: Partial<Record<PlateStage, number>> = {};
    for (const plate of plates) result[plate.stage] = (result[plate.stage] ?? 0) + 1;
    return result;
  }, [plates]);
  const visible = filter === "ALL" ? plates : plates.filter((p) => p.stage === filter);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.serial));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (allVisibleSelected) next.delete(p.serial);
        else next.add(p.serial);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filtrar por etapa" className="flex flex-wrap gap-2">
        {(["ALL", ...STAGE_ORDER.filter((s) => counts[s])] as const).map((stage) => (
          <button
            key={stage}
            type="button"
            aria-pressed={filter === stage}
            onClick={() => setFilter(stage)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === stage ? "border-brand bg-brand text-brand-foreground" : "hover:bg-muted")}
          >
            {stage === "ALL" ? `Todas (${plates.length})` : `${STAGE_LABEL[stage]} (${counts[stage]})`}
          </button>
        ))}
        {selected.size > 0 ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selected.size} selecionada{selected.size === 1 ? "" : "s"}</span>
            <DownloadButton size="sm" href={`/api/admin/plates/batches/${batchId}/export/pdf?serials=${encodeURIComponent([...selected].join(","))}`}>
              <Printer className="size-3.5" /> Reimprimir só estas (PDF)
            </DownloadButton>
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 p-3">
                <input type="checkbox" className="size-4" checked={allVisibleSelected} onChange={toggleAll} aria-label="Selecionar todas as placas visíveis" />
              </th>
              <th className="p-3 font-medium">Série</th>
              <th className="p-3 font-medium">Etapa</th>
              <th className="p-3 font-medium">NFC</th>
              <th className="p-3 font-medium">QR</th>
              <th className="p-3 font-medium">Série</th>
              <th className="p-3 font-medium">Cliente</th>
              <th className="p-3 font-medium">Toques</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((plate) => {
              const order = plate.card ? orderByCard[plate.card.id] : null;
              return (
                <tr key={plate.id} className="hover:bg-muted/40">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.has(plate.serial)}
                      aria-label={`Selecionar a placa ${plate.serial}`}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(plate.serial);
                          else next.delete(plate.serial);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="p-3">
                    <button type="button" onClick={() => setOpenId(plate.id)} className="font-mono font-semibold underline-offset-4 hover:underline" aria-label={`Abrir detalhes da placa ${plate.serial}`}>
                      {plate.serial}
                    </button>
                  </td>
                  <td className="p-3">
                    <StageBadge stage={plate.stage} />
                  </td>
                  <td className="p-3">{tick(plate.nfcChecked)}</td>
                  <td className="p-3">{tick(plate.qrChecked)}</td>
                  <td className="p-3">{tick(plate.serialChecked)}</td>
                  <td className="p-3">
                    {plate.card ? (
                      <>
                        {plate.card.companyName}
                        {order ? <span className="block text-xs text-muted-foreground">Pedido de {order.customerName}</span> : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 tabular-nums text-muted-foreground">{plate.card ? "—" : plate.scanCount}</td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Nenhuma placa nesta etapa.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PlateDetailSheet plateId={openId} onClose={() => setOpenId(null)} onChanged={() => router.refresh()} />
    </div>
  );
}
