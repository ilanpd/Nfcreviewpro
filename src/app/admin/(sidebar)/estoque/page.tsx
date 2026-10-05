import Link from "next/link";
import { AlertTriangle, Boxes, CheckCircle2, Factory, PackageCheck, Plus, Wrench } from "lucide-react";
import { KpiCard } from "@nfc-os/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCardUrlGuard } from "@/lib/card-url";
import { EVENT_LABEL } from "@/domain/plates/status";
import { getStockOverview } from "@/services/plates.service";
import { BatchStageBadge } from "./_components/stage-badge";
import { formatDateTime } from "./_components/format";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const overview = await getStockOverview();
  const address = getCardUrlGuard().status;
  const noModels = overview.models.length === 0;

  return (
    <div className="space-y-6">
      {address.kind !== "final" ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>O endereço do cartão ainda é provisório ({address.host || "inválido"})</AlertTitle>
          <AlertDescription>
            É esse endereço que vai gravado no chip e impresso no QR, e ele é permanente. Pode gerar lotes e treinar o fluxo à vontade, mas
            só mande imprimir ou gravar em escala depois de definir o domínio definitivo.
          </AlertDescription>
        </Alert>
      ) : null}

      {noModels ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Boxes className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">Comece criando o modelo da sua primeira placa</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            O modelo guarda a arte, o tamanho e o lugar do QR. Depois é só gerar lotes — a série e o código de cada placa saem sozinhos.
          </p>
          <Button asChild className="mt-4">
            <Link href="/admin/estoque/modelos">
              <Plus className="size-4" /> Criar modelo
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Em estoque" value={overview.totals.IN_STOCK} icon={<PackageCheck />} hint="Conferidas e sem dono: prontas para vender" />
            <KpiCard label="Com clientes" value={overview.totals.ASSIGNED} icon={<CheckCircle2 />} hint="Atribuídas a um cartão" />
            <KpiCard
              label="Em produção"
              value={overview.totals.GENERATED + overview.totals.IN_PRODUCTION}
              icon={<Factory />}
              hint="Geradas ou na gráfica, ainda sem conferir"
            />
            <KpiCard
              label="Defeituosas"
              value={overview.totals.DEFECTIVE}
              icon={<Wrench />}
              hint="Fora de circulação"
              valueClassName={overview.totals.DEFECTIVE > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            />
          </div>

          <section aria-labelledby="modelos-titulo" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="modelos-titulo" className="text-lg font-semibold">
                Estoque por modelo
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/estoque/lotes">
                  <Plus className="size-4" /> Novo lote
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {overview.models.map((model) => {
                const incoming = model.counts.GENERATED + model.counts.IN_PRODUCTION;
                const pct = model.minStock > 0 ? Math.min(100, Math.round((model.counts.IN_STOCK / model.minStock) * 100)) : 100;
                return (
                  <div key={model.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Arte v{model.version}
                          {model.active ? "" : " · desativado"}
                        </p>
                      </div>
                      {model.low ? (
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          Estoque baixo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-3xl font-semibold tracking-tight">
                      {model.counts.IN_STOCK}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">em estoque</span>
                    </p>
                    {model.minStock > 0 ? (
                      <div className="mt-2">
                        <div
                          role="progressbar"
                          aria-valuenow={model.counts.IN_STOCK}
                          aria-valuemin={0}
                          aria-valuemax={model.minStock}
                          aria-label={`Estoque de ${model.name} em relação ao mínimo`}
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                        >
                          <div className={model.low ? "h-full bg-amber-500" : "h-full bg-emerald-500"} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Mínimo definido: {model.minStock}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Sem mínimo definido (sem alerta).</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {incoming > 0 ? `${incoming} a caminho · ` : ""}
                      {model.counts.ASSIGNED} com clientes
                      {model.counts.DEFECTIVE > 0 ? ` · ${model.counts.DEFECTIVE} defeituosa${model.counts.DEFECTIVE === 1 ? "" : "s"}` : ""}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/estoque/lotes?novo=${model.id}`}>Gerar lote</Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/estoque/modelos/${model.id}`}>Editar arte</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="andamento-titulo" className="space-y-3">
              <h2 id="andamento-titulo" className="text-lg font-semibold">
                Lotes em andamento
              </h2>
              {overview.batchesInFlight.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum lote em andamento. Tudo que foi gerado já está conferido.</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {overview.batchesInFlight.map((batch) => (
                    <li key={batch.id}>
                      <Link href={`/admin/estoque/lotes/${batch.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {batch.code} <span className="font-normal text-muted-foreground">· {batch.model.name}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {batch.verified} de {batch.quantity} conferidas
                          </p>
                        </div>
                        <BatchStageBadge stage={batch.stage} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="atividade-titulo" className="space-y-3">
              <h2 id="atividade-titulo" className="text-lg font-semibold">
                Atividade recente
              </h2>
              {overview.events.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Ainda não há atividade.</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {overview.events.map((event) => (
                    <li key={event.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                      <div className="min-w-0">
                        <p>
                          <Link href={`/admin/estoque/placas?q=${encodeURIComponent(event.plate.serial)}`} className="font-mono font-medium underline-offset-4 hover:underline">
                            {event.plate.serial}
                          </Link>{" "}
                          <span className="text-muted-foreground">{EVENT_LABEL[event.type] ?? event.type}</span>
                        </p>
                        {event.note ? <p className="truncate text-xs text-muted-foreground">{event.note}</p> : null}
                      </div>
                      <time dateTime={event.createdAt} className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(event.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
