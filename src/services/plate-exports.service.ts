import "server-only";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { assertCardUrlReady, cardPublicUrl, getCardUrlStatus } from "@/lib/card-url";
import { renderPlatePdf, type PlatePdfVersion } from "@/lib/plates/pdf";
import { buildQrMatrix, type QrErrorCorrection } from "@/lib/plates/qr-vector";
import { effectiveDpi, pageSizeMm, qrModuleSizeMm } from "@/domain/plates/layout";
import { deliverableProblem } from "@/domain/plates/limits";
import { buildManifestCsv } from "@/domain/plates/manifest";
import { STAGE_LABEL, derivePlateStage } from "@/domain/plates/status";
import { PlateProductionSheet, type ProductionSheetData } from "@/services/export/plate-production-sheet";
import { PlateError, getModelVersionFull } from "@/services/plates.service";

/**
 * Estoque de placas (ADR-092) — tudo que sai do painel para a gráfica. Os três
 * arquivos de um lote (arte em PDF, manifesto CSV, ficha de produção) leem
 * dos MESMOS registros, então nunca discordam entre si.
 */

type FullVersion = NonNullable<Awaited<ReturnType<typeof getModelVersionFull>>>;

function toPdfVersion(row: FullVersion): PlatePdfVersion {
  const ec = (["L", "M", "Q", "H"] as const).includes(row.qrErrorCorrection as QrErrorCorrection) ? (row.qrErrorCorrection as QrErrorCorrection) : "M";
  return {
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    bleedMm: row.bleedMm,
    qrXMm: row.qrXMm,
    qrYMm: row.qrYMm,
    qrSizeMm: row.qrSizeMm,
    serialEnabled: row.serialEnabled,
    serialXMm: row.serialXMm,
    serialYMm: row.serialYMm,
    serialFontPt: row.serialFontPt,
    background: row.background ? new Uint8Array(row.background) : null,
    backgroundMime: row.backgroundMime,
    qrErrorCorrection: ec,
    qrDarkColor: row.qrDarkColor,
    qrLightColor: row.qrLightColor,
    serialColor: row.serialColor,
  };
}

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
}

async function loadBatchForExport(batchId: string) {
  const batch = await prisma.plateBatch.findUnique({
    where: { id: batchId },
    include: {
      model: { select: { name: true } },
      plates: { orderBy: { index: "asc" }, select: { serial: true, uniqueCode: true, status: true, cardId: true } },
    },
  });
  if (!batch) throw new PlateError("Lote não encontrado.", 404);
  const version = await prisma.plateModelVersion.findUnique({ where: { id: batch.modelVersionId } });
  if (!version) throw new PlateError("A versão de arte deste lote não existe mais.", 500);
  return { batch, version };
}

/** Falha ANTES de a plataforma recusar a resposta com um erro opaco (limite de ~4,5 MB). */
function assertDeliverable(bytes: Uint8Array | Buffer | string) {
  const size = typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes.byteLength;
  const problem = deliverableProblem(size);
  if (problem) throw new PlateError(problem, 413, "FILE_TOO_LARGE");
}

export interface ExportFile {
  bytes: Uint8Array | Buffer | string;
  filename: string;
}

/** PDF de produção. `serials` reimprime só algumas placas do lote (ex.: as que vieram com defeito). */
export async function buildBatchPdf(batchId: string, options: { serials?: string[] } = {}): Promise<ExportFile> {
  assertCardUrlReady();
  const { batch, version } = await loadBatchForExport(batchId);
  let plates = batch.plates.filter((p) => p.status !== "VOIDED");
  if (options.serials?.length) {
    const wanted = new Set(options.serials.map((s) => s.trim().toUpperCase()));
    plates = plates.filter((p) => wanted.has(p.serial));
    if (plates.length === 0) throw new PlateError("Nenhuma das placas pedidas pertence a este lote.", 404);
  }
  if (plates.length === 0) throw new PlateError("Este lote não tem placas para imprimir.", 409);

  const bytes = await renderPlatePdf(
    toPdfVersion(version),
    plates.map((p) => ({ serial: p.serial, url: cardPublicUrl(p.uniqueCode) })),
    { title: `Lote ${batch.code} — ${batch.model.name}`, subject: `Versão ${version.version} da arte` }
  );
  assertDeliverable(bytes);
  const suffix = options.serials?.length ? `-reimpressao-${plates.length}` : "";
  return { bytes, filename: `${batch.code}-${slug(batch.model.name)}-v${version.version}${suffix}.pdf` };
}

export async function buildBatchManifest(batchId: string): Promise<ExportFile> {
  assertCardUrlReady();
  const { batch } = await loadBatchForExport(batchId);
  const csv = buildManifestCsv(
    batch.plates.map((p) => ({
      serial: p.serial,
      code: p.uniqueCode,
      url: cardPublicUrl(p.uniqueCode),
      status: STAGE_LABEL[derivePlateStage(p)],
      batch: batch.code,
      model: batch.model.name,
    }))
  );
  return { bytes: csv, filename: `${batch.code}-manifesto.csv` };
}

export async function buildProductionSheet(batchId: string): Promise<ExportFile> {
  const { batch, version } = await loadBatchForExport(batchId);
  const address = getCardUrlStatus();
  const page = pageSizeMm(version);
  const ec = (["L", "M", "Q", "H"] as const).includes(version.qrErrorCorrection as QrErrorCorrection) ? (version.qrErrorCorrection as QrErrorCorrection) : "M";
  const sampleUrl = batch.plates[0] ? cardPublicUrl(batch.plates[0].uniqueCode) : cardPublicUrl("abcd2345");
  const modules = buildQrMatrix(sampleUrl, ec).size;
  const dpi =
    version.backgroundWidthPx && version.backgroundHeightPx
      ? Math.round(Math.min(effectiveDpi(version.backgroundWidthPx, page.width), effectiveDpi(version.backgroundHeightPx, page.height)))
      : null;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace(".", ",");

  const baseName = `${batch.code}-${slug(batch.model.name)}-v${version.version}`;
  const data: ProductionSheetData = {
    batchCode: batch.code,
    modelName: batch.model.name,
    modelVersion: version.version,
    createdAt: batch.createdAt.toLocaleDateString("pt-BR"),
    supplier: batch.supplier,
    notes: batch.notes,
    quantity: batch.quantity,
    addressHost: address.host || "inválido",
    addressFinal: address.kind === "final",
    artFileName: `${baseName}.pdf`,
    csvFileName: `${batch.code}-manifesto.csv`,
    spec: [
      { label: "Tamanho final (corte)", value: `${fmt(version.widthMm)} × ${fmt(version.heightMm)} mm` },
      { label: "Sangria", value: `${fmt(version.bleedMm)} mm em cada lado` },
      { label: "Tamanho da página do PDF", value: `${fmt(page.width)} × ${fmt(page.height)} mm` },
      { label: "Resolução da arte", value: dpi ? `${dpi} dpi neste tamanho` : "sem arte de fundo (fundo branco)" },
      {
        label: "QR",
        value: `${fmt(version.qrSizeMm)} mm de lado · quadradinho de ${qrModuleSizeMm(version.qrSizeMm, modules).toFixed(2).replace(".", ",")} mm · correção de erros ${ec} · ${version.qrDarkColor} sobre ${version.qrLightColor}`,
      },
      { label: "Série impressa", value: version.serialEnabled ? `corpo ${fmt(version.serialFontPt)} pt, cor ${version.serialColor}` : "não impressa" },
    ],
    rows: batch.plates.map((p) => ({ serial: p.serial, code: p.uniqueCode, url: cardPublicUrl(p.uniqueCode) })),
  };
  const bytes = await renderToBuffer(createElement(PlateProductionSheet, { data }) as unknown as Parameters<typeof renderToBuffer>[0]);
  return { bytes, filename: `${batch.code}-ficha-de-producao.pdf` };
}

/** PDF de prova de um modelo (QR e série de exemplo): mostra exatamente como a gráfica receberia a arte. */
export async function buildModelProofPdf(modelId: string, versionNumber?: number): Promise<ExportFile> {
  const version = await getModelVersionFull(modelId, versionNumber);
  if (!version) throw new PlateError("Versão do modelo não encontrada.", 404);
  const model = await prisma.plateModel.findUnique({ where: { id: modelId }, select: { name: true } });
  const bytes = await renderPlatePdf(toPdfVersion(version), [{ serial: "L000-00", url: cardPublicUrl("exemplo0") }], {
    title: `Prova — ${model?.name ?? "modelo"} v${version.version}`,
    subject: "PDF de prova (QR e série de exemplo)",
  });
  assertDeliverable(bytes);
  return { bytes, filename: `prova-${slug(model?.name ?? "modelo")}-v${version.version}.pdf` };
}
