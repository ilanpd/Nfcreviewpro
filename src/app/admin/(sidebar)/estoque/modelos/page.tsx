import Link from "next/link";
import { ImageIcon, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { effectiveDpi, pageSizeMm } from "@/domain/plates/layout";
import { listPlateModels } from "@/services/plates.service";
import { NewModelDialog } from "./new-model-dialog";
import { formatDate } from "../_components/format";

export const dynamic = "force-dynamic";

export default async function ModelosPage() {
  const models = await listPlateModels();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          O modelo é o molde da placa: a arte de fundo, o tamanho e o lugar onde o QR e a série entram. Cada vez que você salva uma mudança, nasce uma
          versão nova — os lotes já gerados continuam presos à versão com que foram impressos.
        </p>
        <NewModelDialog />
      </div>

      {models.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum modelo ainda. Crie o primeiro para poder gerar lotes.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {models.map((model) => {
            const latest = model.versions[0];
            const page = latest ? pageSizeMm(latest) : null;
            const dpi =
              latest?.backgroundWidthPx && latest.backgroundHeightPx && page
                ? Math.round(Math.min(effectiveDpi(latest.backgroundWidthPx, page.width), effectiveDpi(latest.backgroundHeightPx, page.height)))
                : null;
            return (
              <div key={model.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{model.name}</p>
                    {model.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{model.description}</p> : null}
                  </div>
                  {!model.active ? <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Desativado</span> : null}
                </div>
                {latest ? (
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Versão</dt>
                    <dd>v{latest.version} · {formatDate(latest.createdAt.toISOString())}</dd>
                    <dt className="text-muted-foreground">Tamanho</dt>
                    <dd>
                      {latest.widthMm} × {latest.heightMm} mm (+{latest.bleedMm} de sangria)
                    </dd>
                    <dt className="text-muted-foreground">Arte</dt>
                    <dd className="flex items-center gap-1">
                      <ImageIcon className="size-3" aria-hidden="true" />
                      {latest.backgroundWidthPx ? `${latest.backgroundWidthPx}×${latest.backgroundHeightPx}px (~${dpi} dpi)` : "fundo branco (teste)"}
                    </dd>
                    <dt className="text-muted-foreground">Estoque mínimo</dt>
                    <dd>{model.minStock > 0 ? model.minStock : "sem alerta"}</dd>
                  </dl>
                ) : null}
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link href={`/admin/estoque/modelos/${model.id}`}>
                    <Pencil className="size-3.5" /> Abrir editor
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
