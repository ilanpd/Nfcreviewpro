import { z } from "zod";

/** Estoque de placas (ADR-092) — entradas das rotas do admin. */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use o formato #RRGGBB)");
const mm = (label: string, min = 0, max = 1000) => z.number({ error: `${label} inválido` }).min(min, `${label} muito pequeno`).max(max, `${label} muito grande`);

export const plateLayoutSchema = z.object({
  widthMm: mm("Largura", 10),
  heightMm: mm("Altura", 10),
  bleedMm: mm("Sangria", 0, 20),
  qrXMm: mm("Posição X do QR"),
  qrYMm: mm("Posição Y do QR"),
  qrSizeMm: mm("Tamanho do QR", 10),
  qrErrorCorrection: z.enum(["L", "M", "Q", "H"]),
  qrDarkColor: hexColor,
  qrLightColor: hexColor,
  serialEnabled: z.boolean(),
  serialXMm: mm("Posição X da série"),
  serialYMm: mm("Posição Y da série"),
  serialFontPt: mm("Tamanho da série", 3, 40),
  serialColor: hexColor,
});

export const plateModelCreateSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome ao modelo").max(80),
  description: z.string().trim().max(300).optional(),
  minStock: z.number().int().min(0).max(100000).optional(),
});

export const plateModelMetaSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  minStock: z.number().int().min(0).max(100000).optional(),
  active: z.boolean().optional(),
});

export const plateModelVersionSchema = plateLayoutSchema.extend({
  note: z.string().trim().max(200).optional(),
  /** "keep" mantém a arte da versão anterior; "remove" volta para fundo branco. */
  background: z.enum(["keep", "remove", "replace"]).default("keep"),
});

const batchCommon = {
  modelId: z.string().min(1),
  supplier: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
};

export const MAX_BATCH_QUANTITY = 500;

export const batchCreateSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("STOCK"), quantity: z.number().int().min(1).max(MAX_BATCH_QUANTITY), ...batchCommon }),
  z.object({ mode: z.literal("ORDERS"), orderIds: z.array(z.string().min(1)).min(1).max(100), ...batchCommon }),
]);

export const plateActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("check"),
    nfcChecked: z.boolean().optional(),
    qrChecked: z.boolean().optional(),
    serialChecked: z.boolean().optional(),
  }),
  z.object({ action: z.literal("defective"), reason: z.string().trim().min(3, "Diga o que há de errado com a placa").max(300) }),
  z.object({ action: z.literal("void"), reason: z.string().trim().min(3, "Diga por que a placa está sendo anulada").max(300) }),
  z.object({ action: z.literal("restore") }),
]);

export const plateAssignSchema = z.object({
  cardId: z.string().min(1),
  /** Cartão que já tem uma placa: troca, e a antiga vira defeituosa. */
  replace: z.boolean().optional(),
  replaceReason: z.string().trim().max(300).optional(),
  /** O código do cartão vai mudar: obrigatório quando o dono já pode ter baixado o QR antigo. */
  acceptCodeChange: z.boolean().optional(),
});

/** De onde sai a placa de uma venda: automático do estoque por modelo (FIFO), de um LOTE escolhido (FIFO dentro dele) ou números informados. */
export const platePickSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("AUTO"), modelId: z.string().min(1) }),
  z.object({ mode: z.literal("LOT"), batchId: z.string().min(1) }),
  z.object({ mode: z.literal("SERIALS"), serials: z.array(z.string().trim().min(3).max(20)).min(1).max(50) }),
]);

export const orderPlatesSchema = z.object({
  orderId: z.string().min(1),
  pick: platePickSchema,
  acceptCodeChange: z.boolean().optional(),
});

export type PlateLayoutInput = z.infer<typeof plateLayoutSchema>;
export type PlatePick = z.infer<typeof platePickSchema>;
