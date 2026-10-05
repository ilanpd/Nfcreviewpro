import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { generateCardCode } from "@/lib/codes";
import { cardPublicUrl, getCardUrlGuard } from "@/lib/card-url";
import { invalidateCard } from "@/lib/resolution-engine/cache";
import { formatSerial, nextBatchCode, parseSerial } from "@/domain/plates/serial";
import {
  canAssign,
  canRestore,
  canRetire,
  derivePlateStage,
  statusAfterChecks,
  type PlateChecks,
  type PlateEventType,
  type PlateStage,
  type PlateStatusValue,
} from "@/domain/plates/status";
import { defaultLayout, validateLayout, type LayoutCheck } from "@/domain/plates/layout";
import { artProblem } from "@/domain/plates/limits";
import { emptyCounts, findLowStock, type StageCounts } from "@/domain/plates/stock-summary";
import { buildQrMatrix, type QrErrorCorrection } from "@/lib/plates/qr-vector";
import { MAX_BATCH_QUANTITY, type PlateLayoutInput, type PlatePick } from "@/lib/validations/plates";

/**
 * Estoque de placas (ADR-092). Regra que sustenta o módulo inteiro: a placa
 * existe ANTES do cliente. O código dela (impresso no QR e gravado no chip)
 * nasce na geração do lote; vender é só ligar a placa a um `NFCCard` — o
 * cartão passa a usar o código da placa, nunca o contrário.
 */

export class PlateError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code?: string
  ) {
    super(message);
    this.name = "PlateError";
  }
}

export const MAX_BACKGROUND_BYTES = 3.5 * 1024 * 1024;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

function daysSince(date: Date, now = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Modelos e versões de arte
// ---------------------------------------------------------------------------

// O Prisma seleciona TODAS as colunas por padrão — uma listagem sem este
// `select` arrastaria megabytes de arte de fundo por linha.
export const VERSION_META_SELECT = {
  id: true,
  modelId: true,
  version: true,
  note: true,
  widthMm: true,
  heightMm: true,
  bleedMm: true,
  backgroundMime: true,
  backgroundName: true,
  backgroundWidthPx: true,
  backgroundHeightPx: true,
  qrXMm: true,
  qrYMm: true,
  qrSizeMm: true,
  qrErrorCorrection: true,
  qrDarkColor: true,
  qrLightColor: true,
  serialEnabled: true,
  serialXMm: true,
  serialYMm: true,
  serialFontPt: true,
  serialColor: true,
  createdBy: true,
  createdAt: true,
} satisfies Prisma.PlateModelVersionSelect;

export type VersionMeta = Prisma.PlateModelVersionGetPayload<{ select: typeof VERSION_META_SELECT }>;

/** Módulos por lado de um QR típico desta instalação (depende do tamanho do endereço). */
export function estimateQrModules(errorCorrection: QrErrorCorrection): number {
  return buildQrMatrix(cardPublicUrl("abcd2345"), errorCorrection).size;
}

export async function listPlateModels() {
  return prisma.plateModel.findMany({
    orderBy: { name: "asc" },
    include: { versions: { orderBy: { version: "desc" }, take: 1, select: VERSION_META_SELECT } },
  });
}

export async function getPlateModel(id: string) {
  return prisma.plateModel.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" }, select: VERSION_META_SELECT } },
  });
}

export async function createPlateModel(input: { name: string; description?: string; minStock?: number }, actor: string) {
  const layout = defaultLayout();
  return prisma.plateModel.create({
    data: {
      name: input.name,
      description: input.description,
      minStock: input.minStock ?? 5,
      versions: {
        create: {
          version: 1,
          note: "Versão inicial (fundo branco de teste)",
          createdBy: actor,
          widthMm: layout.widthMm,
          heightMm: layout.heightMm,
          bleedMm: layout.bleedMm,
          qrXMm: layout.qrXMm,
          qrYMm: layout.qrYMm,
          qrSizeMm: layout.qrSizeMm,
          serialEnabled: layout.serialEnabled,
          serialXMm: layout.serialXMm,
          serialYMm: layout.serialYMm,
          serialFontPt: layout.serialFontPt,
          serialColor: "#000000",
        },
      },
    },
  });
}

export async function updatePlateModelMeta(id: string, input: { name?: string; description?: string | null; minStock?: number; active?: boolean }) {
  const existing = await prisma.plateModel.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PlateError("Modelo não encontrado.", 404);
  return prisma.plateModel.update({ where: { id }, data: input });
}

export interface BackgroundUpload {
  bytes: Uint8Array;
  mime: string;
  name: string;
}

export interface SaveVersionResult {
  version: VersionMeta;
  check: LayoutCheck;
}

/**
 * Salvar um modelo NUNCA edita a versão anterior: cria a próxima. Um lote já
 * impresso aponta para a versão exata com que foi gerado, então regerar o PDF
 * daqui a meses devolve a mesma arte, mesmo que o modelo tenha mudado.
 */
export async function savePlateModelVersion(
  modelId: string,
  input: { layout: PlateLayoutInput; note?: string; background: "keep" | "remove" | "replace"; upload?: BackgroundUpload },
  actor: string
): Promise<SaveVersionResult> {
  const model = await prisma.plateModel.findUnique({ where: { id: modelId }, select: { id: true } });
  if (!model) throw new PlateError("Modelo não encontrado.", 404);

  const latest = await prisma.plateModelVersion.findFirst({
    where: { modelId },
    orderBy: { version: "desc" },
    select: { version: true, background: true, backgroundMime: true, backgroundName: true, backgroundWidthPx: true, backgroundHeightPx: true },
  });
  if (!latest) throw new PlateError("O modelo não tem nenhuma versão.", 500);

  let bg: {
    background: Uint8Array<ArrayBuffer> | null;
    backgroundMime: string | null;
    backgroundName: string | null;
    backgroundWidthPx: number | null;
    backgroundHeightPx: number | null;
  };
  if (input.background === "replace") {
    const upload = input.upload;
    if (!upload) throw new PlateError("Escolha o arquivo da arte.", 400);
    if (upload.mime !== "image/png" && upload.mime !== "image/jpeg") throw new PlateError("A arte precisa ser PNG ou JPG.", 400);
    if (upload.bytes.byteLength > MAX_BACKGROUND_BYTES) {
      throw new PlateError(
        `A arte tem ${(upload.bytes.byteLength / 1024 / 1024).toFixed(1)} MB; o limite é 3,5 MB. Exporte como JPG (qualidade alta) ou reduza o PNG.`,
        413
      );
    }
    let dims;
    try {
      // Carregado só aqui: o gerador de PDF (pdf-lib) não precisa pesar em rotas
      // que importam este serviço de passagem, como o webhook do Stripe.
      const { inspectBackground } = await import("@/lib/plates/pdf");
      dims = await inspectBackground(upload.bytes, upload.mime);
    } catch {
      throw new PlateError("Não consegui abrir essa imagem. Exporte de novo como PNG ou JPG comum (sem CMYK exótico).", 400);
    }
    bg = {
      background: new Uint8Array(upload.bytes),
      backgroundMime: upload.mime,
      backgroundName: upload.name.slice(0, 120),
      backgroundWidthPx: dims.widthPx,
      backgroundHeightPx: dims.heightPx,
    };
  } else if (input.background === "remove") {
    bg = { background: null, backgroundMime: null, backgroundName: null, backgroundWidthPx: null, backgroundHeightPx: null };
  } else {
    bg = {
      background: latest.background ? new Uint8Array(latest.background) : null,
      backgroundMime: latest.backgroundMime,
      backgroundName: latest.backgroundName,
      backgroundWidthPx: latest.backgroundWidthPx,
      backgroundHeightPx: latest.backgroundHeightPx,
    };
  }

  const check = validateLayout(input.layout, {
    qrModules: estimateQrModules(input.layout.qrErrorCorrection),
    background: bg.backgroundWidthPx && bg.backgroundHeightPx ? { widthPx: bg.backgroundWidthPx, heightPx: bg.backgroundHeightPx } : null,
  });
  if (check.errors.length > 0) throw new PlateError(check.errors.join(" "), 400);

  // A arte entra no PDF uma vez. Uma foto em PNG vira um PDF muito maior que o
  // arquivo enviado; melhor descobrir agora do que quando a gráfica pedir o lote.
  if (input.background === "replace" && bg.background && bg.backgroundMime) {
    const { renderPlatePdf } = await import("@/lib/plates/pdf");
    const onePage = await renderPlatePdf(
      {
        ...input.layout,
        background: bg.background,
        backgroundMime: bg.backgroundMime,
      },
      [{ serial: "L000-00", url: cardPublicUrl("exemplo0") }],
      { title: "Estimativa de tamanho" }
    );
    const problem = artProblem(onePage.byteLength);
    if (problem) throw new PlateError(problem, 413, "ART_TOO_HEAVY");
  }

  try {
    const version = await prisma.plateModelVersion.create({
      data: { modelId, version: latest.version + 1, note: input.note, createdBy: actor, ...input.layout, ...bg },
      select: VERSION_META_SELECT,
    });
    return { version, check };
  } catch (error) {
    if (isUniqueViolation(error)) throw new PlateError("Outra edição aconteceu ao mesmo tempo. Recarregue a página e tente de novo.", 409);
    throw error;
  }
}

/** Versão completa (com os bytes da arte) — só para quem vai gerar PDF ou servir a imagem. */
export async function getModelVersionFull(modelId: string, version?: number) {
  return prisma.plateModelVersion.findFirst({
    where: { modelId, ...(version ? { version } : {}) },
    orderBy: { version: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Lotes
// ---------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;

/** Códigos novos, únicos contra placas E cartões (nunca um QR de duas coisas). */
async function generateUniqueCodes(tx: Tx, count: number): Promise<string[]> {
  const codes = new Set<string>();
  for (let attempt = 0; attempt < 8; attempt++) {
    while (codes.size < count) codes.add(generateCardCode());
    const list = [...codes];
    const [cards, plates] = await Promise.all([
      tx.nFCCard.findMany({ where: { uniqueCode: { in: list } }, select: { uniqueCode: true } }),
      tx.plate.findMany({ where: { uniqueCode: { in: list } }, select: { uniqueCode: true } }),
    ]);
    const taken = new Set([...cards, ...plates].map((row) => row.uniqueCode));
    if (taken.size === 0) return list;
    for (const code of taken) codes.delete(code);
  }
  throw new PlateError("Não consegui gerar códigos únicos. Tente de novo.", 500);
}

interface Seed {
  uniqueCode: string;
  cardId?: string;
}

async function createBatchWithPlates(
  tx: Tx,
  params: {
    model: { id: string };
    versionId: string;
    origin: "STOCK" | "ORDERS";
    orderIds: string[];
    seeds: Seed[];
    supplier?: string;
    notes?: string;
    actor: string;
  }
) {
  const existing = await tx.plateBatch.findMany({ select: { code: true } });
  const code = nextBatchCode(existing.map((b) => b.code));
  const quantity = params.seeds.length;
  const now = new Date();

  const batch = await tx.plateBatch.create({
    data: {
      code,
      modelId: params.model.id,
      modelVersionId: params.versionId,
      origin: params.origin,
      orderIds: params.orderIds,
      quantity,
      supplier: params.supplier,
      notes: params.notes,
      createdBy: params.actor,
    },
  });

  await tx.plate.createMany({
    data: params.seeds.map((seed, i) => ({
      batchId: batch.id,
      modelId: params.model.id,
      index: i + 1,
      serial: formatSerial(code, i + 1, quantity),
      uniqueCode: seed.uniqueCode,
      cardId: seed.cardId ?? null,
      assignedAt: seed.cardId ? now : null,
    })),
  });

  const plates = await tx.plate.findMany({ where: { batchId: batch.id }, select: { id: true, cardId: true } });
  await tx.plateEvent.createMany({
    data: plates.flatMap((plate) => [
      { plateId: plate.id, type: "GENERATED" satisfies PlateEventType, toStatus: "GENERATED" as const, actor: params.actor },
      ...(plate.cardId
        ? [{ plateId: plate.id, type: "ASSIGNED" satisfies PlateEventType, note: "Gerada já para um pedido pago", actor: params.actor }]
        : []),
    ]),
  });
  return batch;
}

async function withBatchRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      // Dois lotes criados no mesmo instante disputam o mesmo código ("L003").
      if (isUniqueViolation(error) && attempt < 3) continue;
      throw error;
    }
  }
}

async function loadActiveModelVersion(modelId: string) {
  const model = await prisma.plateModel.findUnique({
    where: { id: modelId },
    select: { id: true, name: true, active: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, version: true } } },
  });
  if (!model) throw new PlateError("Modelo não encontrado.", 404);
  if (!model.active) throw new PlateError("Este modelo está desativado. Reative-o para gerar lotes.", 409);
  const version = model.versions[0];
  if (!version) throw new PlateError("O modelo não tem nenhuma versão de arte.", 500);
  return { model, version };
}

export async function createStockBatch(
  input: { modelId: string; quantity: number; supplier?: string; notes?: string },
  actor: string
) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_BATCH_QUANTITY) {
    throw new PlateError(`A quantidade precisa estar entre 1 e ${MAX_BATCH_QUANTITY}.`, 400);
  }
  const { model, version } = await loadActiveModelVersion(input.modelId);
  return withBatchRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const codes = await generateUniqueCodes(tx, input.quantity);
        return createBatchWithPlates(tx, {
          model,
          versionId: version.id,
          origin: "STOCK",
          orderIds: [],
          seeds: codes.map((uniqueCode) => ({ uniqueCode })),
          supplier: input.supplier,
          notes: input.notes,
          actor,
        });
      },
      { timeout: 30_000 }
    )
  );
}

/**
 * Produção sob demanda: um lote para pedidos já pagos. Cada cartão desses
 * pedidos ganha uma placa que JÁ nasce com o código do cartão — não há troca
 * de código, então nada que o cliente já tenha visto deixa de valer.
 */
export async function createOrdersBatch(
  input: { modelId: string; orderIds: string[]; supplier?: string; notes?: string },
  actor: string
) {
  const { model, version } = await loadActiveModelVersion(input.modelId);
  const orders = await prisma.storeOrder.findMany({
    where: { id: { in: input.orderIds } },
    select: { id: true, status: true, provisionedCardIds: true, customerName: true },
  });
  if (orders.length !== input.orderIds.length) throw new PlateError("Algum dos pedidos escolhidos não existe mais.", 404);
  const notPaid = orders.find((o) => o.status !== "PAID");
  if (notPaid) throw new PlateError(`O pedido de ${notPaid.customerName} não está na fila de produção (só pedidos pagos e ainda não enviados).`, 409);
  const notProvisioned = orders.find((o) => o.provisionedCardIds.length === 0);
  if (notProvisioned) throw new PlateError(`O pedido de ${notProvisioned.customerName} ainda não foi provisionado.`, 409);

  const cards = await prisma.nFCCard.findMany({
    where: { id: { in: orders.flatMap((o) => o.provisionedCardIds) }, plate: null },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: { id: true, uniqueCode: true },
  });
  if (cards.length === 0) throw new PlateError("Todos os cartões desses pedidos já têm placa.", 409);
  if (cards.length > MAX_BATCH_QUANTITY) throw new PlateError(`Um lote comporta no máximo ${MAX_BATCH_QUANTITY} placas.`, 400);

  return withBatchRetry(() =>
    prisma.$transaction(
      (tx) =>
        createBatchWithPlates(tx, {
          model,
          versionId: version.id,
          origin: "ORDERS",
          orderIds: input.orderIds,
          seeds: cards.map((card) => ({ uniqueCode: card.uniqueCode, cardId: card.id })),
          supplier: input.supplier,
          notes: input.notes,
          actor,
        }),
      { timeout: 30_000 }
    )
  );
}

export async function markBatchSent(batchId: string, actor: string) {
  const batch = await prisma.plateBatch.findUnique({ where: { id: batchId }, select: { id: true, sentAt: true } });
  if (!batch) throw new PlateError("Lote não encontrado.", 404);
  if (batch.sentAt) throw new PlateError("Este lote já foi marcado como enviado.", 409);
  await prisma.$transaction(async (tx) => {
    await tx.plateBatch.update({ where: { id: batchId }, data: { sentAt: new Date() } });
    const plates = await tx.plate.findMany({ where: { batchId, status: "GENERATED" }, select: { id: true } });
    await tx.plate.updateMany({ where: { batchId, status: "GENERATED" }, data: { status: "IN_PRODUCTION" } });
    await tx.plateEvent.createMany({
      data: plates.map((p) => ({ plateId: p.id, type: "BATCH_SENT" satisfies PlateEventType, fromStatus: "GENERATED" as const, toStatus: "IN_PRODUCTION" as const, actor })),
    });
  });
}

export async function markBatchReceived(batchId: string, actor: string) {
  const batch = await prisma.plateBatch.findUnique({ where: { id: batchId }, select: { id: true, sentAt: true, receivedAt: true } });
  if (!batch) throw new PlateError("Lote não encontrado.", 404);
  if (batch.receivedAt) throw new PlateError("Este lote já foi marcado como recebido.", 409);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.plateBatch.update({ where: { id: batchId }, data: { receivedAt: now, sentAt: batch.sentAt ?? now } });
    const plates = await tx.plate.findMany({ where: { batchId, status: { in: ["GENERATED", "IN_PRODUCTION"] } }, select: { id: true, status: true } });
    await tx.plate.updateMany({ where: { batchId, status: "GENERATED" }, data: { status: "IN_PRODUCTION" } });
    await tx.plateEvent.createMany({
      data: plates.map((p) => ({ plateId: p.id, type: "BATCH_RECEIVED" satisfies PlateEventType, fromStatus: p.status, toStatus: "IN_PRODUCTION" as const, actor })),
    });
  });
}

// ---------------------------------------------------------------------------
// Consultas (formato pronto para a tela — datas viram texto ISO)
// ---------------------------------------------------------------------------

export interface PlateRowDTO {
  id: string;
  serial: string;
  uniqueCode: string;
  status: PlateStatusValue;
  stage: PlateStage;
  nfcChecked: boolean;
  qrChecked: boolean;
  serialChecked: boolean;
  defectReason: string | null;
  scanCount: number;
  lastScannedAt: string | null;
  assignedAt: string | null;
  verifiedAt: string | null;
  batch: { id: string; code: string };
  modelId: string;
  modelName: string;
  card: { id: string; name: string; companyId: string; companyName: string } | null;
}

const PLATE_ROW_INCLUDE = {
  batch: { select: { id: true, code: true } },
  model: { select: { name: true } },
  card: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
} satisfies Prisma.PlateInclude;

type PlateWithRelations = Prisma.PlateGetPayload<{ include: typeof PLATE_ROW_INCLUDE }>;

function toPlateRow(plate: PlateWithRelations): PlateRowDTO {
  return {
    id: plate.id,
    serial: plate.serial,
    uniqueCode: plate.uniqueCode,
    status: plate.status,
    stage: derivePlateStage(plate),
    nfcChecked: plate.nfcChecked,
    qrChecked: plate.qrChecked,
    serialChecked: plate.serialChecked,
    defectReason: plate.defectReason,
    scanCount: plate.scanCount,
    lastScannedAt: plate.lastScannedAt?.toISOString() ?? null,
    assignedAt: plate.assignedAt?.toISOString() ?? null,
    verifiedAt: plate.verifiedAt?.toISOString() ?? null,
    batch: plate.batch,
    modelId: plate.modelId,
    modelName: plate.model.name,
    card: plate.card ? { id: plate.card.id, name: plate.card.name, companyId: plate.card.company.id, companyName: plate.card.company.name } : null,
  };
}

function stageWhere(stage: PlateStage): Prisma.PlateWhereInput {
  switch (stage) {
    case "GENERATED":
      return { status: "GENERATED" };
    case "IN_PRODUCTION":
      return { status: "IN_PRODUCTION" };
    case "IN_STOCK":
      return { status: "VERIFIED", cardId: null };
    case "ASSIGNED":
      return { status: "VERIFIED", cardId: { not: null } };
    case "DEFECTIVE":
      return { status: "DEFECTIVE" };
    case "VOIDED":
      return { status: "VOIDED" };
  }
}

export interface PlateFilters {
  q?: string;
  stage?: PlateStage;
  modelId?: string;
  batchId?: string;
  /** Mais antigas primeiro (a ordem em que o estoque deve sair); o padrão é a mais nova primeiro. */
  fifo?: boolean;
  take?: number;
  skip?: number;
}

export async function listPlates(filters: PlateFilters = {}) {
  const and: Prisma.PlateWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    const serial = parseSerial(q);
    and.push({
      OR: [
        ...(serial ? [{ index: serial.index, batch: { code: serial.batchCode } }] : []),
        { serial: { contains: q.toUpperCase() } },
        { uniqueCode: { contains: q.toLowerCase() } },
        { card: { name: { contains: q, mode: "insensitive" as const } } },
        { card: { company: { name: { contains: q, mode: "insensitive" as const } } } },
      ],
    });
  }
  if (filters.stage) and.push(stageWhere(filters.stage));
  if (filters.modelId) and.push({ modelId: filters.modelId });
  if (filters.batchId) and.push({ batchId: filters.batchId });
  const where: Prisma.PlateWhereInput = and.length ? { AND: and } : {};

  const take = Math.min(filters.take ?? 100, 500);
  const [rows, total] = await Promise.all([
    prisma.plate.findMany({
      where,
      include: PLATE_ROW_INCLUDE,
      orderBy: [{ batch: { createdAt: filters.fifo ? "asc" : "desc" } }, { index: "asc" }],
      take,
      skip: filters.skip ?? 0,
    }),
    prisma.plate.count({ where }),
  ]);
  return { plates: rows.map(toPlateRow), total };
}

export async function getPlateDetail(id: string) {
  const plate = await prisma.plate.findUnique({
    where: { id },
    include: { ...PLATE_ROW_INCLUDE, events: { orderBy: { createdAt: "desc" }, take: 100 } },
  });
  if (!plate) return null;
  const order = plate.cardId
    ? await prisma.storeOrder.findFirst({
        where: { provisionedCardIds: { has: plate.cardId } },
        select: { id: true, customerName: true, status: true, createdAt: true },
      })
    : null;
  const guard = getCardUrlGuard();
  return {
    plate: toPlateRow(plate),
    // Endereço que está (ou ficará) no chip e no QR desta placa; nulo se o ambiente recusa endereço provisório.
    publicUrl: guard.blocked ? null : cardPublicUrl(plate.uniqueCode),
    events: plate.events.map((e) => ({
      id: e.id,
      type: e.type as PlateEventType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
    })),
    order: order ? { id: order.id, customerName: order.customerName, status: order.status, createdAt: order.createdAt.toISOString() } : null,
  };
}

export type BatchStage = "GENERATED" | "AT_SUPPLIER" | "RECEIVED" | "VERIFIED";

export function deriveBatchStage(batch: { sentAt: Date | null; receivedAt: Date | null }, counts: StageCounts, quantity: number): BatchStage {
  const done = counts.IN_STOCK + counts.ASSIGNED + counts.DEFECTIVE + counts.VOIDED;
  if (batch.receivedAt && done >= quantity) return "VERIFIED";
  if (batch.receivedAt) return "RECEIVED";
  if (batch.sentAt) return "AT_SUPPLIER";
  return "GENERATED";
}

export async function listBatches() {
  const [batches, unassigned, assigned] = await Promise.all([
    prisma.plateBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: { model: { select: { id: true, name: true } }, modelVersion: { select: { version: true } } },
    }),
    prisma.plate.groupBy({ by: ["batchId", "status"], where: { cardId: null }, _count: { _all: true } }),
    prisma.plate.groupBy({ by: ["batchId", "status"], where: { cardId: { not: null } }, _count: { _all: true } }),
  ]);
  const countsByBatch: Record<string, StageCounts> = {};
  for (const [rows, isAssigned] of [
    [unassigned, false],
    [assigned, true],
  ] as const) {
    for (const row of rows) {
      const counts = (countsByBatch[row.batchId] ??= emptyCounts());
      counts[derivePlateStage({ status: row.status, cardId: isAssigned ? "x" : null })] += row._count._all;
    }
  }
  return batches.map((batch) => {
    const counts = countsByBatch[batch.id] ?? emptyCounts();
    return {
      id: batch.id,
      code: batch.code,
      origin: batch.origin,
      quantity: batch.quantity,
      supplier: batch.supplier,
      createdAt: batch.createdAt.toISOString(),
      sentAt: batch.sentAt?.toISOString() ?? null,
      receivedAt: batch.receivedAt?.toISOString() ?? null,
      model: batch.model,
      modelVersion: batch.modelVersion.version,
      counts,
      stage: deriveBatchStage(batch, counts, batch.quantity),
      verified: counts.IN_STOCK + counts.ASSIGNED,
    };
  });
}

export async function getBatchDetail(id: string) {
  const batch = await prisma.plateBatch.findUnique({
    where: { id },
    include: {
      model: { select: { id: true, name: true, minStock: true } },
      modelVersion: { select: VERSION_META_SELECT },
      plates: { orderBy: { index: "asc" }, include: PLATE_ROW_INCLUDE },
    },
  });
  if (!batch) return null;
  const plates = batch.plates.map(toPlateRow);
  const counts = emptyCounts();
  for (const plate of plates) counts[plate.stage] += 1;

  const cardIds = plates.flatMap((p) => (p.card ? [p.card.id] : []));
  const orders = cardIds.length
    ? await prisma.storeOrder.findMany({
        where: { provisionedCardIds: { hasSome: cardIds } },
        select: { id: true, customerName: true, status: true, provisionedCardIds: true },
      })
    : [];
  const orderByCard: Record<string, { id: string; customerName: string; status: string }> = {};
  for (const order of orders) for (const cardId of order.provisionedCardIds) orderByCard[cardId] = { id: order.id, customerName: order.customerName, status: order.status };

  return {
    batch: {
      id: batch.id,
      code: batch.code,
      origin: batch.origin,
      orderIds: batch.orderIds,
      quantity: batch.quantity,
      supplier: batch.supplier,
      notes: batch.notes,
      createdBy: batch.createdBy,
      createdAt: batch.createdAt.toISOString(),
      sentAt: batch.sentAt?.toISOString() ?? null,
      receivedAt: batch.receivedAt?.toISOString() ?? null,
      model: batch.model,
      modelVersion: batch.modelVersion,
      stage: deriveBatchStage(batch, counts, batch.quantity),
    },
    counts,
    plates,
    orderByCard,
  };
}

/** Pedidos pagos, provisionados e ainda com cartões sem placa — a fila do lote sob demanda. */
export async function listOrdersWaitingForPlates() {
  const orders = await prisma.storeOrder.findMany({
    where: { status: "PAID", provisionedAt: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, customerName: true, quantity: true, createdAt: true, provisionedCardIds: true },
    take: 200,
  });
  const cardIds = orders.flatMap((o) => o.provisionedCardIds);
  const withPlate = cardIds.length
    ? await prisma.plate.findMany({ where: { cardId: { in: cardIds } }, select: { cardId: true } })
    : [];
  const hasPlate = new Set(withPlate.map((p) => p.cardId));
  return orders
    .map((o) => ({
      id: o.id,
      customerName: o.customerName,
      createdAt: o.createdAt.toISOString(),
      missing: o.provisionedCardIds.filter((id) => !hasPlate.has(id)).length,
    }))
    .filter((o) => o.missing > 0);
}

// ---------------------------------------------------------------------------
// Conferência e ciclo de vida
// ---------------------------------------------------------------------------

async function loadPlate(id: string) {
  const plate = await prisma.plate.findUnique({ where: { id }, include: { batch: { select: { id: true, sentAt: true, receivedAt: true } } } });
  if (!plate) throw new PlateError("Placa não encontrada.", 404);
  return plate;
}

export async function setPlateChecks(id: string, patch: Partial<PlateChecks>, actor: string) {
  const plate = await loadPlate(id);
  if (plate.status === "DEFECTIVE" || plate.status === "VOIDED") {
    throw new PlateError("Esta placa está defeituosa ou anulada. Restaure-a antes de conferir.", 409);
  }
  const checks: PlateChecks = {
    nfcChecked: patch.nfcChecked ?? plate.nfcChecked,
    qrChecked: patch.qrChecked ?? plate.qrChecked,
    serialChecked: patch.serialChecked ?? plate.serialChecked,
  };
  const next = statusAfterChecks(plate.status, checks);
  const now = new Date();
  const becameVerified = next === "VERIFIED" && plate.status !== "VERIFIED";
  const lostVerification = next !== "VERIFIED" && plate.status === "VERIFIED";

  await prisma.$transaction(async (tx) => {
    // Conferir uma placa é prova de que o lote chegou — quem esquece de clicar
    // em "Recebido" não fica travado.
    if (!plate.batch.receivedAt) {
      await tx.plateBatch.update({ where: { id: plate.batch.id }, data: { receivedAt: now, sentAt: plate.batch.sentAt ?? now } });
    }
    await tx.plate.update({
      where: { id },
      data: { ...checks, status: next, verifiedAt: becameVerified ? now : lostVerification ? null : undefined },
    });
    const changed = (Object.keys(checks) as (keyof PlateChecks)[]).filter((k) => checks[k] !== plate[k]);
    if (changed.length) {
      const labels: Record<keyof PlateChecks, string> = { nfcChecked: "NFC", qrChecked: "QR", serialChecked: "série" };
      await tx.plateEvent.create({
        data: {
          plateId: id,
          type: "CHECKED" satisfies PlateEventType,
          note: changed.map((k) => `${labels[k]} ${checks[k] ? "ok" : "desmarcado"}`).join(", "),
          actor,
        },
      });
    }
    if (becameVerified) {
      await tx.plateEvent.create({ data: { plateId: id, type: "VERIFIED" satisfies PlateEventType, fromStatus: plate.status, toStatus: "VERIFIED", actor } });
    } else if (lostVerification) {
      await tx.plateEvent.create({ data: { plateId: id, type: "UNVERIFIED" satisfies PlateEventType, fromStatus: "VERIFIED", toStatus: next, actor } });
    }
  });
}

export async function markPlateDefective(id: string, reason: string, actor: string) {
  const plate = await loadPlate(id);
  if (plate.cardId) throw new PlateError("Esta placa já está com um cliente. Use \"Trocar placa\": a defeituosa é marcada na troca.", 409);
  if (!canRetire(plate)) throw new PlateError("Esta placa já está fora de uso.", 409);
  await prisma.$transaction([
    prisma.plate.update({ where: { id }, data: { status: "DEFECTIVE", defectReason: reason, verifiedAt: null } }),
    prisma.plateEvent.create({ data: { plateId: id, type: "DEFECTIVE", fromStatus: plate.status, toStatus: "DEFECTIVE", note: reason, actor } }),
  ]);
}

export async function voidPlate(id: string, reason: string, actor: string) {
  const plate = await loadPlate(id);
  if (plate.cardId) throw new PlateError("Esta placa já está com um cliente e não pode ser anulada.", 409);
  if (!canRetire(plate)) throw new PlateError("Esta placa já está fora de uso.", 409);
  await prisma.$transaction([
    prisma.plate.update({ where: { id }, data: { status: "VOIDED", defectReason: reason, verifiedAt: null } }),
    prisma.plateEvent.create({ data: { plateId: id, type: "VOIDED", fromStatus: plate.status, toStatus: "VOIDED", note: reason, actor } }),
  ]);
}

export async function restorePlate(id: string, actor: string) {
  const plate = await loadPlate(id);
  if (!canRestore(plate)) throw new PlateError("Só placas defeituosas ou anuladas podem ser restauradas.", 409);
  await prisma.$transaction([
    prisma.plate.update({
      where: { id },
      data: { status: "IN_PRODUCTION", defectReason: null, nfcChecked: false, qrChecked: false, serialChecked: false, verifiedAt: null },
    }),
    prisma.plateEvent.create({ data: { plateId: id, type: "RESTORED", fromStatus: plate.status, toStatus: "IN_PRODUCTION", note: "Voltou a ser conferida do zero", actor } }),
  ]);
}

// ---------------------------------------------------------------------------
// Atribuição: ligar uma placa a um cliente
// ---------------------------------------------------------------------------

function reasonCannotAssign(plate: { status: PlateStatusValue; cardId: string | null; serial: string }): string {
  if (plate.cardId) return `A placa ${plate.serial} já está com outro cliente.`;
  if (plate.status === "DEFECTIVE") return `A placa ${plate.serial} está marcada como defeituosa.`;
  if (plate.status === "VOIDED") return `A placa ${plate.serial} foi anulada.`;
  return `A placa ${plate.serial} ainda não foi conferida (NFC, QR e série). Confira antes de entregar.`;
}

export interface AssignResult {
  plateId: string;
  serial: string;
  uniqueCode: string;
  previousCode: string;
  codeChanged: boolean;
}

export async function assignPlateToCard(
  input: { plateId: string; cardId: string; replace?: boolean; replaceReason?: string; acceptCodeChange?: boolean },
  actor: string
): Promise<AssignResult> {
  let result: AssignResult;
  try {
    result = await prisma.$transaction(async (tx) => {
      const plate = await tx.plate.findUnique({ where: { id: input.plateId } });
      if (!plate) throw new PlateError("Placa não encontrada.", 404);
      const card = await tx.nFCCard.findUnique({
        where: { id: input.cardId },
        select: {
          id: true,
          name: true,
          uniqueCode: true,
          company: { select: { name: true, accountType: true } },
          plate: { select: { id: true, serial: true, status: true } },
        },
      });
      if (!card) throw new PlateError("Cartão não encontrado.", 404);

      if (plate.cardId === card.id) {
        return { plateId: plate.id, serial: plate.serial, uniqueCode: plate.uniqueCode, previousCode: card.uniqueCode, codeChanged: false };
      }
      if (!canAssign(plate)) throw new PlateError(reasonCannotAssign(plate), 409);

      const codeChanged = card.uniqueCode !== plate.uniqueCode;
      // Um assinante com painel pode ter baixado o QR do código antigo — quando
      // o código muda, quem atribui precisa dizer que sabe disso.
      if (codeChanged && card.company.accountType === "CUSTOMER" && !input.acceptCodeChange) {
        throw new PlateError(
          `O cartão "${card.name}" é de ${card.company.name}, que tem acesso ao painel. Atribuir esta placa troca o código do cartão: se o cliente já baixou ou imprimiu o QR antigo, ele deixa de funcionar. Confirme para seguir.`,
          409,
          "CODE_CHANGE_CONFIRMATION"
        );
      }

      if (card.plate) {
        if (!input.replace) {
          throw new PlateError(`Este cartão já tem a placa ${card.plate.serial}. Use "Trocar placa" para substituí-la.`, 409, "CARD_HAS_PLATE");
        }
        await tx.plate.update({
          where: { id: card.plate.id },
          data: { cardId: null, assignedAt: null, status: "DEFECTIVE", defectReason: input.replaceReason?.trim() || "Trocada por outra placa" },
        });
        await tx.plateEvent.create({
          data: {
            plateId: card.plate.id,
            type: "REPLACED",
            fromStatus: card.plate.status,
            toStatus: "DEFECTIVE",
            note: `Substituída pela ${plate.serial}${input.replaceReason ? ` — ${input.replaceReason}` : ""}`,
            actor,
          },
        });
      }

      if (codeChanged) await tx.nFCCard.update({ where: { id: card.id }, data: { uniqueCode: plate.uniqueCode } });
      await tx.plate.update({ where: { id: plate.id }, data: { cardId: card.id, assignedAt: new Date() } });
      await tx.plateEvent.create({
        data: {
          plateId: plate.id,
          type: "ASSIGNED",
          note: `Cartão "${card.name}" (${card.company.name})${codeChanged ? ` — código ${card.uniqueCode} → ${plate.uniqueCode}` : ""}`,
          actor,
        },
      });
      return { plateId: plate.id, serial: plate.serial, uniqueCode: plate.uniqueCode, previousCode: card.uniqueCode, codeChanged };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PlateError("Conflito ao atribuir: o código da placa já está em uso por outro cartão. Tente de novo ou escolha outra placa.", 409);
    }
    throw error;
  }

  if (result.codeChanged) await Promise.all([invalidateCard(result.previousCode), invalidateCard(result.uniqueCode)]);
  return result;
}

/** Devolve a placa ao estoque; o cartão ganha um código novo (a placa leva o dela embora). */
export async function unassignPlate(plateId: string, actor: string) {
  const plate = await prisma.plate.findUnique({ where: { id: plateId }, select: { id: true, serial: true, uniqueCode: true, cardId: true } });
  if (!plate) throw new PlateError("Placa não encontrada.", 404);
  if (!plate.cardId) throw new PlateError("Esta placa não está atribuída a ninguém.", 409);
  const cardId = plate.cardId;

  await prisma.$transaction(async (tx) => {
    const [fresh] = await generateUniqueCodes(tx, 1);
    await tx.nFCCard.update({ where: { id: cardId }, data: { uniqueCode: fresh } });
    await tx.plate.update({ where: { id: plateId }, data: { cardId: null, assignedAt: null } });
    await tx.plateEvent.create({ data: { plateId, type: "UNASSIGNED", note: `Cartão ficou com o código novo ${fresh}`, actor } });
  });
  await invalidateCard(plate.uniqueCode);
}

/** As N placas conferidas mais antigas do modelo (primeiro a entrar, primeiro a sair). */
async function pickStockPlates(modelId: string, count: number) {
  return prisma.plate.findMany({
    where: { modelId, status: "VERIFIED", cardId: null },
    orderBy: [{ batch: { createdAt: "asc" } }, { index: "asc" }],
    take: count,
    select: { id: true, serial: true },
  });
}

/** Resolve a escolha (automática ou por número) em placas reais, sem gravar nada. */
export async function resolvePlatePick(pick: PlatePick, needed: number): Promise<{ id: string; serial: string }[]> {
  if (pick.mode === "AUTO") {
    const plates = await pickStockPlates(pick.modelId, needed);
    if (plates.length < needed) {
      const model = await prisma.plateModel.findUnique({ where: { id: pick.modelId }, select: { name: true } });
      throw new PlateError(
        `Só há ${plates.length} placa(s) conferida(s) em estoque do modelo "${model?.name ?? "?"}" e a venda precisa de ${needed}.`,
        409,
        "NOT_ENOUGH_STOCK"
      );
    }
    return plates;
  }

  if (pick.serials.length !== needed) {
    throw new PlateError(`Informe ${needed} número(s) de placa — foram informados ${pick.serials.length}.`, 400);
  }
  const resolved: { id: string; serial: string }[] = [];
  for (const raw of pick.serials) {
    const parsed = parseSerial(raw);
    if (!parsed) throw new PlateError(`"${raw}" não parece um número de placa (exemplo: L001-07).`, 400);
    const plate = await prisma.plate.findFirst({
      where: { index: parsed.index, batch: { code: parsed.batchCode } },
      select: { id: true, serial: true, status: true, cardId: true },
    });
    if (!plate) throw new PlateError(`Não existe a placa ${raw}.`, 404);
    if (!canAssign(plate)) throw new PlateError(reasonCannotAssign(plate), 409);
    resolved.push({ id: plate.id, serial: plate.serial });
  }
  if (new Set(resolved.map((p) => p.id)).size !== resolved.length) throw new PlateError("Há um número de placa repetido.", 400);
  return resolved;
}

/**
 * Entrega placas a um pedido: cada cartão ainda sem placa recebe uma, na
 * ordem. Tudo-ou-nada na ESCOLHA das placas (se não há estoque, nada é
 * atribuído); a gravação é uma placa por vez, então uma falha no meio deixa as
 * já atribuídas valendo e a operação pode ser repetida para as que faltam.
 */
export async function assignPlatesToOrder(
  input: { orderId: string; pick: PlatePick; acceptCodeChange?: boolean },
  actor: string
): Promise<AssignResult[]> {
  const order = await prisma.storeOrder.findUnique({ where: { id: input.orderId }, select: { id: true, provisionedCardIds: true } });
  if (!order) throw new PlateError("Pedido não encontrado.", 404);
  if (order.provisionedCardIds.length === 0) throw new PlateError("Este pedido ainda não foi provisionado: não há cartões para receber placas.", 409);

  const cards = await prisma.nFCCard.findMany({
    where: { id: { in: order.provisionedCardIds }, plate: null },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (cards.length === 0) throw new PlateError("Todos os cartões deste pedido já têm placa.", 409);

  const plates = await resolvePlatePick(input.pick, cards.length);
  const results: AssignResult[] = [];
  for (let i = 0; i < cards.length; i++) {
    results.push(await assignPlateToCard({ plateId: plates[i].id, cardId: cards[i].id, acceptCodeChange: input.acceptCodeChange }, actor));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tela pública: "placa ainda não ativada"
// ---------------------------------------------------------------------------

export async function getPublicPlate(code: string) {
  const plate = await prisma.plate.findUnique({
    where: { uniqueCode: code },
    select: { serial: true, status: true, cardId: true },
  });
  if (!plate) return null;
  return { serial: plate.serial, status: plate.status, assigned: plate.cardId !== null };
}

/** Conta o toque numa placa sem dono — prova que o NFC/QR dessa placa leem. Nunca derruba a página. */
export async function recordUnassignedPlateScan(code: string) {
  try {
    await prisma.plate.updateMany({
      where: { uniqueCode: code, cardId: null },
      data: { scanCount: { increment: 1 }, lastScannedAt: new Date() },
    });
  } catch (error) {
    console.error("[plates] falha ao registrar o toque da placa", error);
  }
}

// ---------------------------------------------------------------------------
// Painel: visão geral e radar
// ---------------------------------------------------------------------------

async function loadModelCounts(): Promise<Record<string, StageCounts>> {
  const [unassigned, assigned] = await Promise.all([
    prisma.plate.groupBy({ by: ["modelId", "status"], where: { cardId: null }, _count: { _all: true } }),
    prisma.plate.groupBy({ by: ["modelId", "status"], where: { cardId: { not: null } }, _count: { _all: true } }),
  ]);
  const byModel: Record<string, StageCounts> = {};
  for (const [rows, isAssigned] of [
    [unassigned, false],
    [assigned, true],
  ] as const) {
    for (const row of rows) {
      const counts = (byModel[row.modelId] ??= emptyCounts());
      counts[derivePlateStage({ status: row.status, cardId: isAssigned ? "x" : null })] += row._count._all;
    }
  }
  return byModel;
}

export async function getStockOverview() {
  const [models, byModel, batches, events] = await Promise.all([
    listPlateModels(),
    loadModelCounts(),
    listBatches(),
    prisma.plateEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, type: true, note: true, actor: true, createdAt: true, plate: { select: { id: true, serial: true } } },
    }),
  ]);
  const low = findLowStock(models, byModel);
  const totals = emptyCounts();
  for (const counts of Object.values(byModel)) for (const key of Object.keys(counts) as PlateStage[]) totals[key] += counts[key];

  return {
    totals,
    models: models.map((model) => ({
      id: model.id,
      name: model.name,
      active: model.active,
      minStock: model.minStock,
      version: model.versions[0]?.version ?? 1,
      counts: byModel[model.id] ?? emptyCounts(),
      low: low.find((l) => l.modelId === model.id) ?? null,
    })),
    batchesInFlight: batches.filter((b) => b.stage !== "VERIFIED").slice(0, 6),
    events: events.map((e) => ({
      id: e.id,
      type: e.type as PlateEventType,
      note: e.note,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
      plate: e.plate,
    })),
  };
}

export interface RadarPlateInputs {
  plateStock: { modelId: string; modelName: string; inStock: number; minStock: number; incoming: number }[];
  plateBatches: { id: string; code: string; kind: "AT_SUPPLIER" | "AWAITING_CHECK"; days: number; pending?: number }[];
}

const PENDING_STATUSES: PlateStatusValue[] = ["GENERATED", "IN_PRODUCTION"];

export async function getRadarPlateInputs(now = new Date()): Promise<RadarPlateInputs> {
  const [models, byModel, batches] = await Promise.all([
    prisma.plateModel.findMany({ select: { id: true, name: true, minStock: true, active: true } }),
    loadModelCounts(),
    prisma.plateBatch.findMany({
      where: {
        OR: [
          { sentAt: { not: null }, receivedAt: null },
          { receivedAt: { not: null }, plates: { some: { status: { in: PENDING_STATUSES } } } },
        ],
      },
      select: {
        id: true,
        code: true,
        sentAt: true,
        receivedAt: true,
        _count: { select: { plates: { where: { status: { in: PENDING_STATUSES } } } } },
      },
    }),
  ]);
  return {
    plateStock: findLowStock(models, byModel).filter((l) => l.inStock + l.incoming < l.minStock),
    plateBatches: batches.flatMap((batch): RadarPlateInputs["plateBatches"] => {
      if (batch.receivedAt) return [{ id: batch.id, code: batch.code, kind: "AWAITING_CHECK", days: daysSince(batch.receivedAt, now), pending: batch._count.plates }];
      if (batch.sentAt) return [{ id: batch.id, code: batch.code, kind: "AT_SUPPLIER", days: daysSince(batch.sentAt, now) }];
      return [];
    }),
  };
}

/** Número do selo na barra lateral. Nunca derruba o painel: sem as tabelas, zero. */
export async function getStockAttentionCount(): Promise<number> {
  try {
    const radar = await getRadarPlateInputs();
    return radar.plateStock.length + radar.plateBatches.filter((b) => (b.kind === "AWAITING_CHECK" ? b.days >= 2 : b.days >= 10)).length;
  } catch (error) {
    console.error("[plates] não foi possível calcular o selo do estoque", error);
    return 0;
  }
}
