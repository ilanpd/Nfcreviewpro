import { z } from "zod";

const tableShapeSchema = z.enum(["RECTANGLE", "CIRCLE"]);

// Table Map (Phase 5) layout — every field optional so a drag (x/y only), a
// resize (width/height only), or a rotate (rotation only) can each PATCH
// just what changed. `layoutX`/`layoutY` are nullable-on-purpose elsewhere
// (an unplaced table), but never explicitly nulled back out from the UI —
// there's no "remove from canvas" action, so this schema only ever writes
// real numbers to them.
// Achado real ao vivo (11/09/2026): `.finite()` sozinho só barra NaN/
// Infinity — deixou passar uma mesa com layoutY na casa dos milhares
// (provavelmente um arrasto que deu errado em algum momento), o suficiente
// pra fazer o "enquadrar tudo" do Mapa de Mesas centralizar num vazio entre
// essa mesa e todas as outras, deixando o mapa inteiro em branco pro
// usuário. O limite abaixo é generoso o bastante pra qualquer salão real
// (±20.000 unidades — mil células de grid em cada direção) e barra só
// valores claramente vindos de bug, não de uso legítimo.
const LAYOUT_COORD_BOUND = 20_000;
const layoutCoordSchema = z.number().finite().min(-LAYOUT_COORD_BOUND).max(LAYOUT_COORD_BOUND);

export const updateCardLayoutSchema = z.object({
  layoutX: layoutCoordSchema.optional(),
  layoutY: layoutCoordSchema.optional(),
  layoutWidth: z.number().finite().min(24).max(600).optional(),
  layoutHeight: z.number().finite().min(24).max(600).optional(),
  layoutRotation: z.number().finite().optional(),
  tableShape: tableShapeSchema.optional(),
  seats: z.number().int().min(1).max(40).optional(),
});

export const bulkUpdateCardLayoutSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().cuid(),
        layoutX: layoutCoordSchema,
        layoutY: layoutCoordSchema,
      })
    )
    .min(1)
    .max(500),
});

export type UpdateCardLayoutInput = z.infer<typeof updateCardLayoutSchema>;
export type BulkUpdateCardLayoutInput = z.infer<typeof bulkUpdateCardLayoutSchema>;

export const createCardSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(60),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  tableShape: tableShapeSchema.optional(),
  seats: z.number().int().min(1).max(40).optional(),
});

export const updateCardSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  active: z.boolean().optional(),
  tableShape: tableShapeSchema.optional(),
  seats: z.number().int().min(1).max(40).optional(),
  // Nullable (not just optional) so a card can be explicitly unassigned from
  // its branch/zone, not only reassigned to a different one.
  branchId: z.string().cuid().nullable().optional(),
  zoneId: z.string().cuid().nullable().optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
