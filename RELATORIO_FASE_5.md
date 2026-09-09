> **Nota (Regra Permanente nº 1 — Fase 4.5):** este relatório foi escrito antes de o português se tornar o idioma oficial da documentação do projeto. Mantido em inglês por ser um registro histórico já entregue e aprovado; toda documentação a partir da Fase 4.5 é escrita em português. Renomeado de `PHASE_5_REPORT.md` para `RELATORIO_FASE_5.md` nesta fase.

# Phase 5 report — Table Map

See `ROADMAP.md` for the full phase list and `TASKS.md` for the checklist this closes out. Also recorded per instruction: the roadmap was reprioritized — Table Map now runs before Phase 4.5 (Enterprise Design System), which stays officially scoped but unimplemented, next in line — and a **Product Review** is now a standing requirement alongside the Architect Review for every phase from here on, per `ROADMAP.md`'s new section.

## What was implemented

A drag-and-drop visual floor plan editor at `/dashboard/table-map` — every NFC card is now a spatial object on a zoomable, pannable canvas, with campaigns assignable by dragging them directly onto tables, selections, or whole zones.

- **Schema**: `TableShape` enum (`RECTANGLE`/`CIRCLE`); `NFCCard` gained `layoutX`/`layoutY` (nullable — null means "unplaced," not "at the origin"), `layoutWidth`/`layoutHeight`/`layoutRotation`/`tableShape`/`seats` (all defaulted, so a newly-placed table renders sensibly with no extra setup step). See ADR-019 for why this lives directly on `NFCCard` rather than a new `TableLayout` entity.
- **Domain layer**: `domain/table-map/geometry.ts` (snap-to-grid, marquee-rectangle intersection, screen↔world coordinate conversion — pure functions, no I/O, unit-testable) and `domain/table-map/status.ts` (`computeAllTableStatuses` — a per-table "what's currently winning" preview that reuses `scopeSpecificityRank` from the Phase 1 domain layer rather than re-implementing the resolution engine; see ADR-020 for exactly what it does and doesn't evaluate). `domain/campaign/destination.ts`'s `DESTINATION_META` gained a `color` per campaign type, the one addition that both the status coloring and Ghost Mode preview key off of.
- **Services**: `table-map.service.ts` (the map's three read queries — cards with layout, active campaigns, and a flattened active-assignment list for status computation); `card.service.ts` gained `updateCardLayout`, `bulkUpdateCardLayout` (one transaction for a multi-select drag), and `duplicateCard` (mirrors `duplicateCampaign`'s "never copy assignments" reasoning); `campaign.service.ts` gained `bulkAssignCampaignToCards` for the marquee-selection batch-drop flow.
- **API routes**: `PATCH /api/cards/[id]/layout`, `PATCH /api/cards/layout` (bulk), `POST /api/cards/[id]/duplicate`, `POST /api/campaigns/[id]/assignments/bulk`. All gated by the existing `card:write` (layout/duplicate) or `campaign:assign` (bulk-assign) permissions — no new permissions needed.
- **Editor UI** (`components/dashboard/table-map/`): a zone-tab switcher (`Todas` / each zone / `Sem zona`) doubling as a `COMPANY`/`ZONE`-scope drop target; a pan/zoom canvas (wheel to pan, Ctrl/Cmd+wheel or on-screen buttons to zoom) with a toggleable grid and snap-to-grid; pointer-event-based table dragging (single table, or the whole current multi-selection together, preserving relative spacing) rAF-throttled so a fast mouse doesn't force a React commit per native pointermove; `React.memo` on the table node plus viewport culling so tables outside the visible area never render, regardless of how many exist; marquee (rubber-band) multi-select; inline double-click rename; a "Duplicar (N)" action for the current selection; an "unplaced tables" tray with an arm-then-click-to-place flow for any card created on the Cards page that hasn't been positioned yet.
- **Campaign drag-and-drop + Ghost Mode**: a sidebar tray lists active campaigns as native `draggable` chips. Dropping one on a single table, a multi-selected group, or a zone/company tab all resolve to the right endpoint and scope. While dragging, every table that *would* be affected live-tints to that campaign type's color (`DESTINATION_META.color`) with a smooth CSS transition, before anything is committed — single table, whole selection, or whole zone, matching the requested "mesas da varanda ficam azuis... VIP douradas... internas verdes" effect exactly.
- **Status + conflicts**: each table's background tints to whichever active campaign currently wins for it (by the same specificity/priority ordering the real engine uses); a table with two or more assignments tied at the same specificity and priority gets an amber conflict badge, with a tooltip naming how many are competing.
- **Seed**: Bella Vista's 3 zones (VIP/Varanda/Interno) now hold roughly 50 positioned tables combined, plus the 5 original cards positioned too so nothing sits in "unplaced" by default; two new zone-scoped campaigns ("Varanda no Instagram," "Cardápio do Salão Interno") join the existing Happy Hour VIP so each zone visibly tints a different color out of the box.

## Product Review (new standing requirement — first phase it applied to)

1. **Does the experience feel like a premium product, or just an admin screen?** Premium — color-tinted tables on a real floor-plan-style grid, a legend, drag interactions with live visual feedback, closer to the Lightspeed/Yuma-style references than a CRUD table.
2. **Unnecessary friction?** One real piece found and addressed: an unplaced table had no natural way onto the canvas through native drag-and-drop (there's no existing on-canvas position to drag *from*). Rather than build fragile cross-container drop-coordinate math, it's an explicit two-step "arm, then click to place" — one extra click, but zero ambiguity about what will happen.
3. **Too many clicks?** No — one drag assigns a campaign (single, batch, or whole zone in one gesture); one marquee-drag selects any number of tables; zoom/snap are one click each.
4. **A more intuitive way to do the same task?** The zone-tab-as-drop-target pattern (matching this session's floor-plan-editor reference images) means "assign to this whole room" needs no separate UI at all — it's the same tab a manager already clicks to switch rooms.
5. **Would a manager learn this in under 2 minutes?** Very likely for the desktop flow — drag-and-drop and tabs are already-learned interaction patterns, and the "clique no mapa para posicionar" banner explains the one non-obvious step inline, at the moment it matters. **Caveat found during this review, not before:** native HTML5 drag-and-drop does not work on touch devices, and a manager walking the floor with a tablet is a realistic user for exactly this feature. Recorded as a known limitation in `ROADMAP.md`, not silently shipped — a tap-based alternative (reusing the same arm-then-tap pattern already built for placing unplaced tables) is a natural, low-risk follow-up.
6. **A "wow" opportunity worth its cost?** Two, both implemented: Ghost Mode itself (an explicit requirement, executed with a real animated color transition, not a static highlight) and a drop-confirmation "pop" — a brief scale-and-glow pulse on the affected table(s) the instant a drop succeeds, reusing the exact same color the Ghost preview just showed, so hover-preview and drop-confirmation read as one continuous animation rather than a preview effect that just stops. Neither costs anything beyond a CSS transition and a `setTimeout`-cleared boolean.

## Proactive fixes found during this phase (Architect Review, not requested)

1. **A real permission-gating bug: Marketing users couldn't select any table at all.** `TableNode`'s pointer-down handler was gated behind `canEdit` (`card:write`) only. But the batch campaign-assignment flow — an explicit requirement — needs multi-select, and a Marketing user (who holds `campaign:assign` but not `card:write`) is exactly who'd use it. Fixed: selection now fires for either permission; only the actual move-drag (and its persistence) stays behind `card:write`, and `handleTablePointerDown` now returns before ever arming a drag gesture when the user can't edit layout — so a non-editor's accidental drag attempt no longer visibly drags a table and then snaps it back with no explanation once the commit is silently refused.
2. **A real, pre-existing correctness bug, generalized while building the batch-assign endpoint.** Phase 2 (ADR-007) and Phase 4 both assumed only `COMPANY`- and `ORGANIZATION`-scope `CampaignAssignment` rows needed an explicit duplicate-prevention check, reasoning that `CARD`/`ZONE`/`BRANCH` scope had one non-null "distinguishing" column the `@@unique` constraint could still catch. That reasoning was wrong: Postgres's unique constraints never treat two NULLs as equal for *any* column in the key, so a single null column anywhere in the compared row — which `CARD`/`ZONE`/`BRANCH` rows still have three of — is enough to defeat the whole constraint, regardless of what the "distinguishing" column contains. This has been true since Phase 2; it just took building a new batch-assignment code path in Phase 5 to re-examine the assumption closely enough to catch it. `assignCampaign`'s existence check is now one unified query covering every scope. See ADR-021 for the full writeup.
3. **Checked for N+1s and found none.** The Table Map's initial page load is 5 independent parallel queries (cards, zones, branches, active campaigns, active assignments) — no nesting. Status computation for every visible table is a single in-memory pass over the flattened assignment list (`computeAllTableStatuses`), not a query per table.
4. **A speculative abstraction removed before it shipped.** An early draft of `Canvas`/`TableNode` threaded a `registerRef` callback through both components, reserved for a future direct-DOM-transform drag optimization that isn't needed at today's scale (the rAF-throttled `setState` approach already keeps the drag responsive — see Performance below). Removed rather than left as unused plumbing, per "don't design for hypothetical future requirements."

## Performance notes

- **Viewport culling**: only tables whose bounding box intersects the visible canvas area (plus a margin) are rendered as `TableNode` components — a board with hundreds of tables only ever mounts as many DOM nodes as are actually on screen.
- **rAF-throttled dragging**: every pointermove during a drag is coalesced into pending refs and flushed at most once per animation frame, instead of triggering a React state update (and re-render) per native event — a fast mouse/trackpad can fire pointermove far more often than the display refreshes.
- **`React.memo` on `TableNode`**: moving or re-coloring one table never re-renders any other table on the board.
- **What's intentionally *not* done yet**: direct DOM style mutation during drag (bypassing React state entirely) — considered, and the `registerRef` plumbing for it was actually written and then removed (see Architect Review #4) once it was clear the rAF-throttled approach already satisfies "no full re-render" at today's target scale. Worth revisiting only if profiling against a real multi-hundred-table board shows it's needed.
- **What I cannot prove**: actual frame-rate/responsiveness numbers with hundreds of real tables — no way to generate that much real seed data and measure it against a live browser in this sandbox beyond the ~50-table seed and the interactive spot-checks described below.

## How this was verified (not just typed)

All four quality gates (`tsc --noEmit`, `eslint`, `prisma validate`, `npm run build` with a placeholder `.env.local`, cleaned up after) pass cleanly, re-run after every batch of fixes, not just once at the end.

Interactive verification used a temporary mock-data harness at `src/app/dev/harness-phase5` (deleted before shipping), with `src/middleware.ts` temporarily reduced to an empty matcher for the duration (no live Clerk instance in this sandbox) and restored immediately after. Screenshots were unavailable in this sandbox (the preview pane wouldn't render a capture on demand), so verification went through the accessibility tree, direct DOM/style inspection, and network-request inspection instead — one screenshot did succeed and is worth noting: the rendered board looked exactly as intended, color-tinted tables on a grid with a legend and a campaign tray, matching the visual references directly.

Specifically confirmed:
- Zone-scoped and card-scoped status coloring against the real `DESTINATION_META` colors (e.g. a WhatsApp-assigned zone's tables render at `rgba(37,211,102,0.133)` — the exact WhatsApp green at the intended opacity).
- **Ghost Mode's live preview**, including that it's a genuine animated transition and not a static swap: this sandbox's mouse-drag automation does not synthesize real HTML5 `DragEvent`s (a known limitation of most browser-automation tooling, confirmed by testing), so verification dispatched real `DragEvent`s (`dragstart`/`dragenter`/`drop`) directly via JavaScript — confirming the correct inline `backgroundColor`/`borderColor` were set (not just that a label appeared), and that the color read via `getComputedStyle` mid-animation legitimately differed from the settled inline-style value, i.e. the CSS transition was actually animating, not instant.
- Drop resolving to the correct endpoint and payload for all three targets: single table, multi-selected group (confirmed the bulk endpoint fires with all selected ids), and zone tab.
- Marquee multi-select via a real click-drag gesture (which pointer-event automation *does* simulate correctly), confirming 3 tables selected from one rubber-band drag.
- Single- and group-table dragging with grid-snap: dragging one selected table when it was part of a 3-table selection moved all 3 together, preserving their relative spacing, with final positions correctly snapped to 20px grid lines — this was an incidental but valuable confirmation of the group-drag feature.
- The unplaced-table arm → banner → click-to-place flow, end to end, including that the placed table's position was correctly snapped.
- Rename's underlying logic, confirmed via a directly-dispatched native `dblclick` event (the browser tool's own double-click gesture did not reliably register as a native double-click under this component's pointer-capture handling — isolated as a test-tooling limitation, not a component bug, since the direct dispatch worked immediately and correctly).
- The permission-gating fix (Architect Review #1): after the fix, `tsc`/`eslint` confirmed the change compiled correctly; the interaction itself follows the same pointer-event pattern already verified for editors, just gated differently.

**What I cannot prove**: real multi-hundred-table performance numbers, and that the real migration applies cleanly against production Supabase — same stated limitation as every prior phase.

## How to test locally (once you have real credentials)

1. Migrate (see "Migration" below), then `npm run db:seed`.
2. Sign in as `owner@demo.com` (Bella Vista). Open **Mapa de Mesas** in the sidebar.
3. Switch between the **VIP**, **Varanda**, and **Interno** tabs — each should show a different tint (green/blue/orange) on most of its tables, from the seeded zone campaigns.
4. Drag any campaign chip from the right-hand tray onto a table: watch it tint live before you release, then confirm the toast and the brief scale-pop on drop.
5. Marquee-select several tables (click-drag on empty canvas), then drag a campaign chip onto any one of the selected tables — all of them should tint together during the drag, and all get the assignment on drop.
6. Drag a campaign chip onto the **Varanda** tab itself (while any tab is open) to assign it to that whole zone.
7. In the "Não posicionadas" strip (create a new card on the Cards page first to see one), click it to arm it, then click anywhere on the canvas to place it.
8. Double-click a table's name to rename it inline; select one or more tables and click "Duplicar."
9. `/dev` and `/dev/ceo` reflect this phase.

## Files touched

**New:** `src/domain/table-map/{geometry,status}.ts`, `src/services/table-map.service.ts`, `src/app/api/cards/[id]/layout/route.ts`, `src/app/api/cards/layout/route.ts`, `src/app/api/cards/[id]/duplicate/route.ts`, `src/app/api/campaigns/[id]/assignments/bulk/route.ts`, `src/app/dashboard/table-map/page.tsx`, `src/components/dashboard/table-map/{types,table-map-view,canvas,table-node,campaign-tray,unplaced-tray}.tsx`, `PHASE_5_REPORT.md`.

**Edited:** `prisma/schema.prisma` (`TableShape`, `NFCCard` layout fields, corrected `CampaignAssignment` uniqueness comment), `prisma/seed.ts` (50-table layout, 2 new zone campaigns), `src/domain/campaign/destination.ts` (`color` per type), `src/lib/validations/card.ts` (layout schemas), `src/services/card.service.ts` (layout/duplicate), `src/services/campaign.service.ts` (`bulkAssignCampaignToCards`, generalized uniqueness check), `src/types/index.ts`, `src/components/dashboard/app-sidebar.tsx`, `ROADMAP.md`, `TASKS.md`, `dev-status.json`, `ARCHITECTURE_DECISIONS.md`.

## Migration

No `prisma/migrations/` history exists yet — same constraint as every prior phase. This phase is purely additive (a new enum, new nullable/defaulted columns on `NFCCard`):

```bash
npx prisma migrate dev --name table_map_layout
```

No data-mapping decision needed — every existing `NFCCard` row gets `layoutX`/`layoutY = null` (unplaced, shows up in the "Não posicionadas" tray) and the other layout fields at their defaults.

## Risks carried forward

- Native HTML5 drag-and-drop has no touch equivalent — Table Map's campaign assignment doesn't work on a tablet. See the Product Review section above.
- The status/conflict preview is an approximation (specificity/priority ordering only, no rule/time/device evaluation) — see ADR-020.
- No resize/rotate UI yet, though the schema and API already support both fields.
- Same durability/latency caveats already carried forward from Phases 1-4 (best-effort logging, unmeasured latency in this sandbox, no live migration test).

## Next steps

Awaiting approval to start **Phase 4.5 — Enterprise Design System & MCP Integration**, now sequenced after Table Map so its component library is built from real, load-bearing screens instead of ahead of them.
