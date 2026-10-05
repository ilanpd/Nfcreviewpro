import Link from "next/link";
import { listBatches, listPlateModels } from "@/services/plates.service";
import { NewBatchDialog } from "./new-batch-dialog";
import { BatchStageBadge } from "../_components/stage-badge";
import { formatDate } from "../_components/format";

export const dynamic = "force-dynamic";

export default async function LotesPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const { novo } = await searchParams;
  const [batches, models] = await Promise.all([listBatches(), listPlateModels()]);
  const activeModels = models.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Um lote é uma remessa para a gráfica. Gere, baixe os arquivos, marque quando enviar e quando receber, e confira placa por placa.
        </p>
        <NewBatchDialog models={activeModels} defaultOpen={Boolean(novo)} defaultModelId={novo} />
      </div>

      {activeModels.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Para gerar um lote você precisa de um modelo ativo.{" "}
          <Link href="/admin/estoque/modelos" className="underline underline-offset-4">
            Criar modelo
          </Link>
        </p>
      ) : null}

      {batches.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum lote ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Lote</th>
                <th className="p-3 font-medium">Modelo</th>
                <th className="p-3 font-medium">Origem</th>
                <th className="p-3 font-medium">Conferência</th>
                <th className="p-3 font-medium">Etapa</th>
                <th className="p-3 font-medium">Criado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.map((batch) => {
                const pct = Math.round((batch.verified / Math.max(1, batch.quantity)) * 100);
                return (
                  <tr key={batch.id} className="hover:bg-muted/40">
                    <td className="p-3">
                      <Link href={`/admin/estoque/lotes/${batch.id}`} className="font-mono font-semibold underline-offset-4 hover:underline">
                        {batch.code}
                      </Link>
                    </td>
                    <td className="p-3">
                      {batch.model.name} <span className="text-xs text-muted-foreground">v{batch.modelVersion}</span>
                    </td>
                    <td className="p-3 text-muted-foreground">{batch.origin === "STOCK" ? "Estoque" : "Pedidos"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div role="progressbar" aria-valuenow={batch.verified} aria-valuemin={0} aria-valuemax={batch.quantity} aria-label={`Lote ${batch.code}: ${batch.verified} de ${batch.quantity} conferidas`} className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {batch.verified}/{batch.quantity}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <BatchStageBadge stage={batch.stage} />
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(batch.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
