import { z } from "zod";

const tableShapeSchema = z.enum(["RECTANGLE", "CIRCLE"]);

// Table Map (Phase 5) layout — every field optional so a drag (x/y only), a
// resize (width/height only), or a rotate (rotation only) can each PATCH
// just what changed. `layoutX`/`layoutY` are nullable-on-purpose elsewhere
// (an unplaced table), but never explicitly nulled back out from the UI —
// there's no "remove from canvas" action, so this schema only ever writes
// real numbers to them.
export const updateCardLayoutSchema = z.object({
  layoutX: z.number().finite().optional(),
  layoutY: z.number().finite().optional(),
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
        layoutX: z.number().finite(),
        layoutY: z.number().finite(),
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
});

export const updateCardSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  active: z.boolean().optional(),
  // Nullable (not just optional) so a card can be explicitly unassigned from
  // its branch/zone, not only reassigned to a different one.
  branchId: z.string().cuid().nullable().optional(),
  zoneId: z.string().cuid().nullable().optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
