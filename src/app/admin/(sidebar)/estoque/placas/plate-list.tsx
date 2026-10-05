"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlateRowDTO } from "@/services/plates.service";
import { PlateDetailSheet } from "../_components/plate-detail-sheet";
import { StageBadge } from "../_components/stage-badge";
import { formatDateTime } from "../_components/format";

/** Lista de placas (de qualquer lote) com o detalhe completo ao clicar numa série. */
export function PlateList({ plates }: { plates: PlateRowDTO[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Série</th>
              <th className="p-3 font-medium">Modelo</th>
              <th className="p-3 font-medium">Etapa</th>
              <th className="p-3 font-medium">Cliente</th>
              <th className="p-3 font-medium">Toques</th>
              <th className="p-3 font-medium">Último toque</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {plates.map((plate) => (
              <tr key={plate.id} className="hover:bg-muted/40">
                <td className="p-3">
                  <button type="button" onClick={() => setOpenId(plate.id)} className="font-mono font-semibold underline-offset-4 hover:underline" aria-label={`Abrir detalhes da placa ${plate.serial}`}>
                    {plate.serial}
                  </button>
                </td>
                <td className="p-3">{plate.modelName}</td>
                <td className="p-3">
                  <StageBadge stage={plate.stage} />
                </td>
                <td className="p-3">{plate.card ? plate.card.companyName : <span className="text-muted-foreground">Sem dono</span>}</td>
                <td className="p-3 tabular-nums text-muted-foreground">{plate.card ? "—" : plate.scanCount}</td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{plate.card ? "—" : formatDateTime(plate.lastScannedAt)}</td>
              </tr>
            ))}
            {plates.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Nenhuma placa encontrada com esses filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PlateDetailSheet plateId={openId} onClose={() => setOpenId(null)} onChanged={() => router.refresh()} />
    </>
  );
}
