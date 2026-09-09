> **Nota (Regra Permanente nº 1 — Fase 4.5):** este relatório foi escrito antes de o português se tornar o idioma oficial da documentação do projeto. Mantido em inglês por ser um registro histórico já entregue e aprovado; toda documentação a partir da Fase 4.5 é escrita em português. Renomeado de `PHASE_1_REPORT.md` para `RELATORIO_FASE_1.md` nesta fase.

# Phase 1 report — Campaign Resolution Engine

See `ROADMAP.md` for the full phase list and `TASKS.md` for the checklist this closes out.

## What was implemented

A new, decoupled **Campaign Resolution Engine** sits in front of `/r/[code]`. On every request it resolves `NFCCard → CampaignAssignment → Campaign → destination`, caching each layer independently in Redis. A company with zero campaigns configured gets **exactly today's behavior** (the star-rating flow) — not via a feature flag, but because there's no campaign data to change anything; this is what makes the change backward compatible by construction rather than by testing.

- **Schema**: `Campaign`, `CampaignAssignment`, `RedirectLog` models + `CampaignType`/`TargetScope`/`RedirectOutcome` enums. Purely additive — no new scalar columns or data backfill on `Company`/`NFCCard`.
- **Engine** (`src/lib/resolution-engine/`): `resolveDestination(uniqueCode)` — the one entry point everything (NFC today, QR/links/a public API later) will call. Internally: cached reads of card/company/campaigns (3 independently-invalidated Redis keys), a pure `resolveDecision()` that filters by active/time-window and sorts by scope-specificity → priority → recency, and a best-effort `RedirectLog` write via `next/server`'s `after()` so logging never blocks the redirect.
- **Two destination types actually render**: `URL_REDIRECT` and `WHATSAPP` (both pure URL construction, Zod-validated). `COUPON`/`AI_MENU` are declared in the schema but show a neutral "not available yet" placeholder — deliberately not the star flow, so a misconfigured campaign can't silently masquerade as the legacy behavior.
- `/r/[code]` now also rate-limits its own page render (reusing the existing `publicCard` limiter) — previously only the client-driven `/api/visits`/`/api/ratings` POSTs were limited, not the page load itself.
- **A real bug found and fixed during testing, not just typechecking**: neither the new cache layer nor the pre-existing `rate-limit.ts` handled a Redis that's *configured but unreachable* (as opposed to unconfigured) — a network blip would have thrown and crashed every caller, including every existing API route. Both now catch and degrade (to Postgres, and to the in-memory limiter, respectively) instead of throwing. This was caught by actually hitting `/r/[code]` against a deliberately-unreachable fake Redis host, not by inspection.
- **Phase 0 alongside this**: `ROADMAP.md`, `TASKS.md`, and a local-only `/dev` status dashboard (`notFound()` in production) reading from `dev-status.json`.

## How to test locally

1. `npm install` (runs `prisma generate` via `postinstall`).
2. Copy `.env.example` → `.env.local` and fill in real Supabase/Clerk/Upstash credentials — the engine needs a live Postgres to resolve anything (see the migration section below before running `db:push`/`db:migrate` against a database that already has data).
3. `npm run dev`, then:
   - Visit `/dev` — the build-status dashboard (only works outside `NODE_ENV=production`).
   - Visit `/r/<a real card's uniqueCode>` with zero campaigns configured for that company — should look and behave identically to before this phase (star rating → Google/feedback).
   - Manually insert a `Campaign` (`type: "URL_REDIRECT"`, `config: {"url": "https://example.com"}`) + a `CampaignAssignment` (`scope: "COMPANY"`) for that company via Prisma Studio (`npm run db:studio`) — reloading `/r/[code]` should now redirect straight to `https://example.com` instead of showing the star flow.
   - Add a second, higher-priority `CARD`-scope campaign targeting one specific card — only that card should redirect differently; every other card in the company keeps using the `COMPANY`-scope one.
4. What I verified myself in this sandbox (no live DB/Redis available here): `tsc --noEmit`, `eslint .`, `prisma validate`, `prisma generate`, and a full `npm run build` (24 routes, including `/r/[code]` and `/dev`) all clean. I also ran the dev server against **deliberately broken** fake Postgres/Redis credentials specifically to confirm the graceful-degradation paths above trigger correctly rather than crash — logs showed the intended `redis GET failed, falling back to Postgres` / `Redis limiter "publicCard" failed, falling back to in-memory` messages before finally failing on the (expected, since it isn't real) fake Postgres connection.

## Files touched

**New:**
- `src/lib/resolution-engine/{types,data,resolve,cache,index}.ts`
- `src/lib/validations/campaign.ts`
- `src/app/dev/page.tsx`
- `ROADMAP.md`, `TASKS.md`, `dev-status.json`, `PHASE_1_REPORT.md`

**Edited:**
- `prisma/schema.prisma` — new enums/models, additive back-relations only
- `src/app/r/[code]/page.tsx` — resolves via the engine, branches on outcome, adds page-level rate limiting
- `src/lib/whatsapp.ts` — added `buildCampaignWhatsAppUrl()`
- `src/services/card.service.ts` — `invalidateCard()` on update/delete
- `src/services/company.service.ts` — `invalidateCompany()` on update
- `src/lib/rate-limit.ts` — Redis-failure fallback to the in-memory limiter (bug fix, see above)

**Untouched, deliberately** (proof of backward compatibility): `src/app/r/[code]/rating-flow.tsx`, `src/services/rating.service.ts`, `src/services/visit.service.ts`, `/api/visits`, `/api/ratings*`.

## Migration — read before running anything against your real database

This repo has **no `prisma/migrations/` folder**, but `package.json` has both `db:push` and `db:migrate` scripts. That means your real Supabase database is either untouched or was synced via `db push` (schema-in-sync, zero migration history). If it's the latter, running `prisma migrate dev` for the first time can make Prisma think it needs to reset the database — **which would drop your data**. I have no live connection to your database from here, so I can't tell which state it's in — do this yourself, in this order:

1. **Back up first** (Supabase → Database → Backups, or a manual `pg_dump`).
2. Check whether it's already in sync: `npx prisma db pull` against `DIRECT_URL`, then diff the result against `prisma/schema.prisma`. If they match (expected if you used `db push` before), continue to step 3. If the database is empty/new, skip to step 4.
3. Baseline the existing schema so `migrate dev` doesn't try to recreate current tables:
   ```bash
   mkdir prisma/migrations/0_baseline
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_baseline/migration.sql
   npx prisma migrate resolve --applied 0_baseline
   ```
4. Generate and apply the real Phase 1 migration:
   ```bash
   npx prisma migrate dev --name add_campaign_resolution_engine
   ```
5. In Supabase's table editor, confirm only `Campaign`, `CampaignAssignment`, `RedirectLog`, and the three new enum types were created — no existing table should show a diff.

## Risks carried forward

- **Migration baseline** (above) — highest severity, must be handled by you against the real database.
- `after()`-based `RedirectLog` writes are best-effort, not durable (can be lost on a hard crash) — acceptable for a lightweight audit log, not a substitute for real event sourcing (planned later).
- `invalidateCompanyCampaigns()` exists but has no caller yet — correct for Phase 1 (no Campaign CRUD exists to call it), but Phase 2's Campaign Manager **must** call it on every create/update/delete/toggle, or edits go stale for up to 60s.
- Postgres treats `NULL` as distinct, so the current `@@unique([campaignId, scope, cardId])` doesn't stop duplicate `COMPANY`-scope assignments per campaign. Harmless today (nothing writes these outside Prisma Studio/seed yet); Phase 2's CRUD must enforce "at most one COMPANY-scope assignment per campaign" at the application layer.
- Sub-100ms resolution latency is a design goal here, not a measured one — this sandbox has no live Postgres/Redis to load-test against. Real numbers will depend on Vercel/Upstash/Supabase region co-location and cold starts once deployed.

## Next steps

Awaiting approval to start **Phase 2 — Campaign Manager V2**: dashboard CRUD for campaigns (create/edit/priority/schedule, assign to a company or a specific card), which also closes the two gaps flagged above (cache invalidation wiring, app-layer uniqueness enforcement).
