> **Nota (Regra Permanente nº 1 — Fase 4.5):** este relatório foi escrito antes de o português se tornar o idioma oficial da documentação do projeto. Mantido em inglês por ser um registro histórico já entregue e aprovado; toda documentação a partir da Fase 4.5 é escrita em português. Renomeado de `PHASE_2_REPORT.md` para `RELATORIO_FASE_2.md` nesta fase.

# Phase 2 report — Campaign Manager V2

See `ROADMAP.md` for the full phase list and `TASKS.md` for the checklist this closes out.

## What was implemented

An enterprise-grade Campaign Manager on top of Phase 1's resolution engine — not just CRUD: a searchable/filterable/sortable dashboard, a premium multi-section Builder with a live destination preview, and a real 4-level assignment system (company/branch/zone/card), all backed by a proper Domain/Repository/Service split for the new module.

- **Schema**: `Campaign` gains `status` (`DRAFT`/`ACTIVE`/`PAUSED`/`ARCHIVED`, replacing the Phase 1 `active` boolean), `description`, `tags`, `ownerId`, `recurrenceType`/`recurrenceConfig`. New `Branch`/`Zone` models (minimal, company-scoped — see "Scope decision" below) with `NFCCard.branchId`/`zoneId`. `CampaignAssignment`/`TargetScope` expanded from `COMPANY`/`CARD` to `COMPANY`/`BRANCH`/`ZONE`/`CARD`.
- **Domain layer** (`src/domain/campaign/`, pure, no I/O): `status.ts` derives the 5 dashboard-facing statuses (Draft/Scheduled/Active/Paused/Completed, plus Archived) from the 4 *stored* ones — Scheduled/Completed are computed from `ACTIVE` + dates, so nothing needs a cron job to "flip" a campaign live or closed; `destination.ts` maps each `CampaignType` to a label/icon/render-group; `assignment.ts` holds scope specificity ranking and shape validation.
- **Repository layer** (`src/repositories/`): raw Prisma access for campaigns/branches/zones, no business rules — mirrors the existing `services/` convention but kept as a distinct layer for this module specifically (see "Why not retrofit the rest of the app" below).
- **Service layer**: `campaign.service.ts` (list/get/create/update/duplicate/archive/delete/assign/unassign — see "Proactive fixes" for the two real bugs closed here), `branch.service.ts`, `zone.service.ts`.
- **Shared, isomorphic destination rendering** (`src/lib/campaign-destination.ts` + `src/lib/utm.ts`): the exact same function computes the Builder's live preview and the resolution engine's actual redirect, so they can never silently disagree about what a customer experiences. Verified interactively (see "How this was tested").
- **Dashboard UI**: `/dashboard/campaigns` — list with client-side search/status-filter/sort; a Sheet-based Campaign Builder with a visual destination-type picker (9 types), conditional config fields + live preview, schedule + recurrence capture, priority, tags, owner; an Assignment Manager supporting all 4 scopes with inline "create a zone/branch on the fly" — this is the "prepare for future drag-and-drop" hook: a future Table Map only needs to call the same `assignCampaign` service, not a new one.
- **Card editing** gained branch/zone assignment — without this, a ZONE/BRANCH-scope campaign would have had no way to actually reach a card through the UI.
- **`/dev/ceo`**: an executive view over the same `dev-status.json` `/dev` reads (percent complete, ready/pending modules, known risks, prioritized backlog) — pulled forward from Phase 12 per this phase's explicit scope.
- **Seed**: the demo company is now **Bella Vista** (renamed from "Demo Restaurante") with 3 zones, 5 cards, and 4 campaigns that exercise all 4 scopes and 3 of the 5 display statuses — see `prisma/seed.ts` for the full narrative.

### Scope decision: minimal `Branch`/`Zone`, not the full franchise hierarchy

The original Phase 1 plan deferred *any* multi-unit modeling to Phase 4, since the eventual `Organization`-wraps-many-`Company` shape wasn't decided. This phase's approved scope explicitly asked for assignment "to a unit or a zone," which needs *something* to assign to now. Rather than block on a decision that still isn't ready, `Branch`/`Zone` ship as flat, optional, single-company-scoped tables — a company with none of either is a single-location business, completely unaffected. The bigger deferred decision (multi-company franchise hierarchy, RBAC roles for it) stays Phase 4's job, now built *on top of* these tables instead of from nothing. This is documented in `ROADMAP.md`'s "Why this order" section so the deviation from the original plan is explicit, not silent.

### Why a Repository layer only for this module, not retrofitted everywhere

The existing `services/*.service.ts` files (cards, company, team, feedback) call Prisma directly — a fine, simple pattern for straightforward CRUD. This phase's explicit scope asked for "clearly separate Domain, Services, Repository, and UI," so the new Campaign module gets that stricter layering. Retrofitting it onto the existing modules would be pure churn with real regression risk for zero requested benefit — skipped deliberately, not an oversight.

## Proactive fixes (found and closed during this phase, not requested)

1. **A real race condition in the "at most one COMPANY-scope assignment per campaign" rule** (flagged as a known gap in the Phase 1 report). Postgres treats `NULL` as distinct, so the schema's `@@unique` can't stop two concurrent requests from both inserting a COMPANY-scope row, and Prisma's schema DSL has no partial-unique-index syntax to fix it at the database level. Closed with a `Serializable` transaction in `campaign.service.ts`'s `assignCampaign` — Postgres itself aborts one of two conflicting transactions (error `P2034`), which is caught and turned into a clean `CampaignConflictError` (HTTP 409) instead of silently allowing a duplicate.
2. **A cross-tenant data-integrity gap in card editing.** `updateCard` accepted any `branchId`/`zoneId` a request supplied with no check that it belonged to the same company — nothing stopped (accidentally or otherwise) reassigning a card to another tenant's branch/zone. Added `assertTargetsInCompany` in `card.service.ts` before Phase 2 even started using those fields for real.
3. **A UTM slug bug caught by actually testing the feature, not just by types.** While interactively exercising the Builder (see below), a campaign named "Cupom de Aniversário" produced `utm_campaign=anivers-rio-...` — the slugify in `lib/utm.ts` didn't strip diacritics before replacing non-alphanumerics, unlike the existing (correct) one in `company.service.ts`. Extracted both into one shared `src/lib/slugify.ts` instead of duplicating the fix, so this class of bug can't reappear in a third place later.

## How this was tested

This sandbox has no live Postgres/Redis (same limitation as Phase 1), so the dashboard's server components can't render against real data here. Rather than stop at "the build passes" — which for a dynamic route like `/dashboard/campaigns` doesn't execute the component at all, only bundles it — a temporary route (`src/app/dev/preview-campaigns`, deleted before this report) rendered the real `CampaignsView` component tree with hand-built mock data matching the actual service return types, with Clerk temporarily bypassed the same way Phase 1's QA did. Through it, this phase actually exercised in a browser: the list's computed display statuses (Draft/Scheduled/Active all rendered correctly), the destination picker (all 9 types, correct icons), the live preview updating in real time as the destination URL was typed (this is what caught the UTM slug bug above), the WhatsApp preview, the recurrence UI (weekly day toggles), edit-mode pre-population of every field including recurrence, and the Assignment Manager's scope switcher populating the right zone list. None of this was assumed from reading the code — every claim above was actually seen on screen.

## How to test locally (once you have real credentials)

1. `npm install`, fill in `.env.local` from `.env.example` (see Phase 1's report for the exact Supabase migration-safety steps if you haven't run those yet).
2. Apply the schema — see "Migration" below first if you haven't migrated since Phase 1.
3. `npm run db:seed` — creates Bella Vista with 3 zones, 5 cards, 4 campaigns.
4. `npm run dev`, sign in, go to `/dashboard/campaigns`:
   - You should see Black Friday 2026 (Agendada), Happy Hour Sexta (Ativa), Google Reviews VIP (Ativa), Instagram Geral (Rascunho).
   - Open a card at `/dashboard/cards` → note "Mesa VIP 1" is in the VIP zone.
   - Visit that card's public URL (`/r/<its uniqueCode>`, shown via "Copiar link") — it should redirect straight to the Google review URL (the CARD-scope campaign wins over the ZONE-scope Happy Hour one by specificity).
   - Visit "Mesa Varanda 1"'s public URL — no campaign targets it or its zone, so it falls back to the normal star-rating flow, proving backward compatibility still holds even with other campaigns active elsewhere in the same company.
   - Edit "Happy Hour Sexta," go to the Atribuições tab, add a CARD-scope assignment to a different table, remove it, confirm the list updates.
   - Try duplicating a campaign (creates a Draft copy, no assignments) and archiving one (status flips, disappears from the default "Ativa" behavior).
5. `/dev` and `/dev/ceo` (non-production only) show this phase reflected in the status dashboard.

## Files touched

**New:** `src/domain/campaign/{status,destination,assignment}.ts`, `src/repositories/{campaign,branch,zone}.repository.ts`, `src/services/{campaign,branch,zone}.service.ts`, `src/lib/{campaign-destination,utm,slugify,dev-status}.ts`, `src/app/api/{campaigns/**,branches/**,zones/**}`, `src/app/dashboard/campaigns/page.tsx`, `src/components/dashboard/campaigns/**` (7 components), `src/app/dev/ceo/page.tsx`, `PHASE_2_REPORT.md`.

**Edited:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/resolution-engine/{types,data,resolve,index}.ts` (4-tier scope, `status` instead of `active`), `src/app/r/[code]/page.tsx` (DRYed to the shared destination renderer), `src/services/card.service.ts` (cross-tenant check), `src/services/company.service.ts` (shared `slugify`), `src/lib/validations/card.ts` (branch/zone fields), `src/lib/api-error.ts` (`CampaignConflictError` → 409), `src/components/dashboard/{app-sidebar,cards-view,card-item,card-form-dialog}.tsx`, `src/app/dashboard/cards/page.tsx`, `src/app/dev/page.tsx` (shared status reader), `ROADMAP.md`, `TASKS.md`, `dev-status.json`, `README.md`.

## Migration

Same hard constraint as Phase 1: this repo has no `prisma/migrations/` folder. If you already ran Phase 1's baseline-then-migrate procedure, this is a normal additive `prisma migrate dev` on top of it. If you haven't migrated since Phase 1, follow Phase 1's full baseline procedure first (back up, `migrate diff --from-empty | migrate resolve --applied`), then run:

```bash
npx prisma migrate dev --name campaign_manager_v2
```

**One thing to check either way:** `Campaign.active` (Boolean) was renamed to `Campaign.status` (enum). If you already created any `Campaign` rows while testing Phase 1 manually, Prisma's migration will ask how to handle that column change — since this is pre-launch test data, dropping and recreating the column (mapping any existing `active: true` rows to `status: ACTIVE`, `false` to `DRAFT`) is safe; if this were real merchant data, it would need an explicit data migration instead. Confirm in Supabase's table editor afterward that only `Campaign`, the new `Branch`/`Zone` tables, and `CampaignAssignment`'s new columns changed — no other existing table should show a diff.

## Risks carried forward

- Migration risk above (same class as Phase 1, now touching one existing column).
- Recurrence is captured, not enforced (see `ROADMAP.md`'s non-goals) — a WEEKLY Happy Hour campaign is live all week until Phase 3.
- The Assignment Manager's "prepare for drag-and-drop" is a clean service boundary, not literal drag-and-drop — Phase 5's Table Map still has real UI work to do, just no new backend contract to invent.
- `Branch`/`Zone` deletion cascades onto their `CampaignAssignment` rows (see schema) — the campaigns cache is correctly invalidated for this (`branch.service.ts`/`zone.service.ts`), but there's no warning UI yet telling a merchant "deleting this zone will stop 2 campaigns from targeting it." Low risk today (no real merchants use this yet) but worth a UX pass before general availability.

## Next steps

Awaiting approval to start **Phase 3 — Rule Engine + A/B testing**, which gives the `evaluateRules()`/`pickVariant()` no-op extension points in `resolve.ts` — and the recurrence data this phase already captures — real behavior.
