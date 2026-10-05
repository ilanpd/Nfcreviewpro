import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ClipboardCheck, FileSpreadsheet, FileText, Printer, Smartphone } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCardUrlGuard } from "@/lib/card-url";
import { getBatchDetail } from "@/services/plates.service";
import { BatchActions } from "./batch-actions";
import { BatchPlateTable } from "./batch-plate-table";
import { BatchStageBadge } from "../../_components/stage-badge";
import { DownloadButton } from "../../_components/download-button";
import { formatDateTime } from "../../_components/format";

export const dynamic = "force-dynamic";

export default async function LotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getBatchDetail(id);
  if (!detail) notFound();
  const { batch, counts, plates, orderByCard } = detail;
  const guard = getCardUrlGuard();
  const pending = plates.filter((p) => p.stage === "GENERATED" || p.stage === "IN_PRODUCTION").length;

  const steps = [
    { label: "Gerado", at: batch.createdAt, done: true },
    { label: "Enviado à gráfica", at: batch.sentAt, done: Boolean(batch.sentAt) },
    { label: "Recebido", at: batch.receivedAt, done: Boolean(batch.receivedAt) },
    { label: "Tudo conferido", at: null, done: batch.stage === "VERIFIED" },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/estoque/lotes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Todos os lotes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="font-mono">{batch.code}</span>
            <BatchStageBadge stage={batch.stage} />
          </h2>
          <p className="text-sm text-muted-foreground">
            {batch.model.name} (arte v{batch.modelVersion.version}) · {batch.quantity} placas · {batch.origin === "STOCK" ? "para estoque" : "para pedidos pagos"}
            {batch.supplier ? ` · ${batch.supplier}` : ""}
          </p>
          {batch.notes ? <p className="mt-1 text-sm text-muted-foreground">Obs.: {batch.notes}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BatchActions batchId={batch.id} code={batch.code} sentAt={batch.sentAt} receivedAt={batch.receivedAt} />
          {pending > 0 || batch.receivedAt ? (
            <Button asChild variant={batch.receivedAt ? "default" : "outline"}>
              <Link href={`/admin/estoque/lotes/${batch.id}/conferir`}>
                <Smartphone className="size-4" /> Conferir lote
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <ol aria-label="Etapas do lote" className="grid gap-2 sm:grid-cols-4">
        {steps.map((step) => (
          <li key={step.label} className={`rounded-lg border p-3 text-sm ${step.done ? "border-emerald-500/40 bg-emerald-500/5" : "text-muted-foreground"}`}>
            <p className="font-medium">
              {step.done ? "✓ " : ""}
              {step.label}
            </p>
            <p className="text-xs text-muted-foreground">{step.at ? formatDateTime(step.at) : step.done ? "" : "pendente"}</p>
          </li>
        ))}
      </ol>

      {!guard.status || guard.status.kind !== "final" ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Endereço provisório ({guard.status.host || "inválido"})</AlertTitle>
          <AlertDescription>
            {guard.blocked
              ? "O ambiente está configurado para recusar endereço provisório: o PDF de arte e o manifesto não serão gerados até o domínio definitivo ser configurado. A ficha de produção sai com o aviso impresso."
              : "Os arquivos abaixo levam o endereço provisório no QR e no chip, e ele é permanente. Use só para teste: antes de mandar produzir em escala, defina o domínio definitivo."}
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="arquivos-titulo" className="space-y-3 rounded-xl border p-4">
        <div>
          <h3 id="arquivos-titulo" className="font-semibold">
            Arquivos para a gráfica
          </h3>
          <p className="text-sm text-muted-foreground">Mande os três juntos: a arte (o que imprimir), a ficha (o que fazer) e o manifesto (o que gravar em cada chip).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DownloadButton href={`/api/admin/plates/batches/${batch.id}/export/pdf`}>
            <Printer className="size-4" /> Arte (PDF)
          </DownloadButton>
          <DownloadButton href={`/api/admin/plates/batches/${batch.id}/export/sheet`}>
            <FileText className="size-4" /> Ficha de produção (PDF)
          </DownloadButton>
          <DownloadButton href={`/api/admin/plates/batches/${batch.id}/export/manifest`}>
            <FileSpreadsheet className="size-4" /> Manifesto (CSV)
          </DownloadButton>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {(
          [
            ["Geradas", counts.GENERATED],
            ["Em produção", counts.IN_PRODUCTION],
            ["Em estoque", counts.IN_STOCK],
            ["Com clientes", counts.ASSIGNED],
            ["Defeituosas", counts.DEFECTIVE],
            ["Anuladas", counts.VOIDED],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="placas-titulo" className="space-y-3">
        <h3 id="placas-titulo" className="flex items-center gap-2 font-semibold">
          <ClipboardCheck className="size-4" aria-hidden="true" /> Placas do lote
        </h3>
        <BatchPlateTable batchId={batch.id} plates={plates} orderByCard={orderByCard} />
      </section>
    </div>
  );
}
