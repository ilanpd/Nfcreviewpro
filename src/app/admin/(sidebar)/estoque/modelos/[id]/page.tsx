import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { effectiveDpi, pageSizeMm } from "@/domain/plates/layout";
import { estimateQrModules, getPlateModel } from "@/services/plates.service";
import { ModelEditor, type EditorVersion } from "./model-editor";
import { ModelMetaForm } from "./model-meta-form";
import { formatDateTime } from "../../_components/format";

export const dynamic = "force-dynamic";

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await getPlateModel(id);
  if (!model) notFound();
  const latest = model.versions[0];

  const editorVersion: EditorVersion = {
    version: latest.version,
    widthMm: latest.widthMm,
    heightMm: latest.heightMm,
    bleedMm: latest.bleedMm,
    qrXMm: latest.qrXMm,
    qrYMm: latest.qrYMm,
    qrSizeMm: latest.qrSizeMm,
    qrErrorCorrection: (["L", "M", "Q", "H"] as const).find((ec) => ec === latest.qrErrorCorrection) ?? "M",
    qrDarkColor: latest.qrDarkColor,
    qrLightColor: latest.qrLightColor,
    serialEnabled: latest.serialEnabled,
    serialXMm: latest.serialXMm,
    serialYMm: latest.serialYMm,
    serialFontPt: latest.serialFontPt,
    serialColor: latest.serialColor,
    backgroundWidthPx: latest.backgroundWidthPx,
    backgroundHeightPx: latest.backgroundHeightPx,
    backgroundName: latest.backgroundName,
  };
  const qrModulesByEc = { L: estimateQrModules("L"), M: estimateQrModules("M"), Q: estimateQrModules("Q"), H: estimateQrModules("H") };

  return (
    <div className="space-y-6">
      <Link href="/admin/estoque/modelos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Todos os modelos
      </Link>

      <ModelMetaForm model={{ id: model.id, name: model.name, description: model.description, minStock: model.minStock, active: model.active }} />

      {/* key = versão: depois de salvar, o editor recomeça já na versão nova. */}
      <ModelEditor key={latest.version} modelId={model.id} version={editorVersion} qrModulesByEc={qrModulesByEc} />

      <section aria-labelledby="versoes-titulo" className="space-y-3">
        <h2 id="versoes-titulo" className="text-lg font-semibold">
          Histórico de versões
        </h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2 font-medium">Versão</th>
                <th className="p-2 font-medium">Quando</th>
                <th className="p-2 font-medium">Quem</th>
                <th className="p-2 font-medium">Arte</th>
                <th className="p-2 font-medium">Nota</th>
                <th className="p-2 font-medium">
                  <span className="sr-only">Prova</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {model.versions.map((v) => {
                const page = pageSizeMm(v);
                const dpi = v.backgroundWidthPx && v.backgroundHeightPx ? Math.round(Math.min(effectiveDpi(v.backgroundWidthPx, page.width), effectiveDpi(v.backgroundHeightPx, page.height))) : null;
                return (
                  <tr key={v.id}>
                    <td className="p-2 font-medium">v{v.version}</td>
                    <td className="p-2 whitespace-nowrap">{formatDateTime(v.createdAt.toISOString())}</td>
                    <td className="p-2 text-muted-foreground">{v.createdBy ?? "—"}</td>
                    <td className="p-2">{dpi ? `~${dpi} dpi` : "fundo branco"}</td>
                    <td className="p-2 text-muted-foreground">{v.note ?? "—"}</td>
                    <td className="p-2 text-right">
                      <a
                        href={`/api/admin/plates/models/${model.id}/proof?v=${v.version}`}
                        target="_blank"
                        rel="noopener"
                        aria-label={`Prova em PDF da versão ${v.version}`}
                        className="inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                      >
                        <FileText className="size-3.5" aria-hidden="true" /> Prova
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
