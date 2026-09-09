> **Nota (Regra Permanente nº 1 — Fase 4.5):** este relatório foi escrito antes de o português se tornar o idioma oficial da documentação do projeto. Mantido em inglês por ser um registro histórico já entregue e aprovado; toda documentação a partir da Fase 4.5 é escrita em português. Renomeado de `PHASE_3_REPORT.md` para `RELATORIO_FASE_3.md` nesta fase.

# Phase 3 report — Rule Engine + A/B Testing

See `ROADMAP.md` for the full phase list and `TASKS.md` for the checklist this closes out. Also recorded this phase, per instruction, purely as documentation: **Phase 4.5 — Enterprise Design System & MCP Integration** is now officially in `ROADMAP.md`/`TASKS.md` between Phase 4 and Phase 5, scoped but not implemented — see `ROADMAP.md`'s "Phase 4.5 scope" section for the full brief.

## What was implemented

The `evaluateRules()`/`pickVariant()` no-op stubs from Phase 1 are now a real, timezone-aware, real-time decision layer, fully integrated into the Campaign Resolution Engine with zero added cost to the cache design.

- **Schema**: `Company.timezone` (IANA identifier, defaults `America/Sao_Paulo`); `RuleType` enum (`DAY_OF_WEEK`/`TIME_WINDOW`/`DATE_RANGE`/`DEVICE_TYPE`); `Rule` model (belongs to a `Campaign`, AND-combined); `CampaignVariant` model (weighted A/B, config validated against the *campaign's own* type); `RuleExecutionLog` (bounded-volume audit trail); `RedirectLog.variantId`.
- **Domain layer** (`src/domain/rules/`, pure, no I/O):
  - `timezone.ts` — decomposes a `Date` into local weekday/hour/minute/date using the native `Intl.DateTimeFormat` API with a `timeZone` option. No date-library dependency added. A "Friday 18:00" rule means 6pm in the business's timezone, not the server's (Vercel runs UTC) — this specifically matters near day boundaries, where the weekday itself can differ between UTC and local time.
  - `evaluate.ts` — one function per `RuleType`, all failing closed (return `false`, never throw) on malformed config, so one bad hand-edited row can't crash the public redirect page.
  - `recurrence.ts` — translates a Campaign's `recurrenceType`/`recurrenceConfig` (captured by the Phase 2 Builder, unenforced until now) into the *same* `RuleLike` shape `evaluate.ts` already handles. This was a deliberate design choice: recurrence goes through one evaluation engine, not a second special-cased one.
  - `variants.ts` — weighted-random selection; injectable RNG for deterministic tests; zero variants means the campaign's own `config` is returned untouched, which is what keeps every existing Phase 1/2 campaign working exactly as before.
- **Engine integration**: `resolve.ts` now evaluates each candidate's rules (its own + recurrence-derived) before the existing specificity→priority→recency sort runs — that ordering is otherwise **completely unchanged**, which is what satisfies "deterministic priority when multiple rules coincide": it was already deterministic, Phase 3 just adds one more filter ahead of it. `index.ts` threads a `deviceType` argument (parsed once from the User-Agent in `/r/[code]/page.tsx`, shared between `generateMetadata` and the page component so `React.cache()`'s dedup still hits) and logs `RuleExecutionLog` rows via `after()`, same best-effort-off-the-response-path pattern as `RedirectLog`.
- **"Cache inteligente sem degradar a resolução pública"**: rules and variants ride along inside the *same* per-company campaigns cache blob Phase 1/2 already built (one extra nested `select` in the same query, no new cache key). `deviceType` is a pure per-request runtime input to the decision function — it never touches the Redis layer at all, so DEVICE_TYPE rules cost nothing in cache design, only in the (already-cheap) in-memory decision step.
- **Dashboard UI**: two new Campaign Builder tabs — **Regras** (type picker with per-type conditional fields: weekday toggles, time-range inputs, date-range inputs, device checkboxes) and **A/B** (name + weight + reuses the existing `DestinationConfigFields` component for the campaign's own destination type, so a variant's editing UI is never out of sync with what its config actually needs).
- **Seed**: Bella Vista's "Happy Hour Sexta" (already `WEEKLY` since Phase 2) is now *actually* gated to Friday 18-22h America/Sao_Paulo instead of being always-on; "Google Reviews VIP" gained a `DEVICE_TYPE` rule (mobile/tablet only); "Black Friday 2026" gained a 70/30 A/B test between two landing-page variants.

## A scope decision worth being explicit about

The long-term wishlist's Rule Engine examples included table/zone/unit and "campaign ended → fallback" as rule dimensions. Before building anything, I checked whether these actually needed new code:

- **Table/zone/unit targeting** is already `CampaignAssignment.scope`'s job (Phase 1/2). Adding it again as a `Rule` dimension would create two mechanisms doing the same thing, with no clear answer to "which one wins when they disagree."
- **"Campaign ended → fall back to Google Reviews"** already works today, unmodified: a campaign past its `endsAt` fails `withinWindow()` and drops out of `eligible`, so the next-highest-priority candidate (or the `REVIEW_FLOW_FALLBACK`) wins automatically — I verified this is exactly the existing Phase 1 behavior, not something Phase 3 needed to add.

So `Rule` only adds what genuinely didn't exist: temporal (day/time/date) and contextual (device) conditions. This is documented in the schema comment, `ROADMAP.md`, and here — not a silent scope cut.

## Proactive fixes and cleanup (found during this phase, not requested)

1. **A real correctness gap: changing a campaign's destination type while it has A/B variants.** A variant's config is validated against its campaign's type only once, at creation. If the type changed afterward (e.g. WHATSAPP → GOOGLE_REVIEWS), the old `{phone, message}` variant config would silently fail `buildDestinationPreview`'s schema check for the new type, and the campaign would start rendering the "Em breve" placeholder instead of the merchant's intended destination — not a crash, but a confusing, hard-to-diagnose behavior change with no error message pointing at the cause. `updateCampaign` now blocks a type change while variants exist, with a clear message to remove them first.
2. **Dead code removed**: `countCompanyScopeAssignments` in `campaign.repository.ts` was defined in Phase 2 but never called — the actual uniqueness check was correctly inlined inside `assignCampaign`'s own transaction instead (it has to run against `tx`, not the repository's plain `prisma` client, for the Serializable isolation to work). Found while extending the same file for rules/variants; removed rather than left to accumulate.

## How this was verified (not just typed)

The riskiest part of this phase — timezone math and weighted randomness — was checked with real numbers before being trusted, the same discipline used for Prisma/Clerk API verification in earlier phases:

- A Friday-18:00-22:00 rule correctly passed for `2026-09-11T21:15:00Z` (18:15 in São Paulo) and correctly failed for the same clock date at the wrong hour and for the following Saturday at the same local hour.
- The overnight-window case (22:00–02:00) correctly wrapped past midnight in both directions.
- A malformed rule config (`startTime: 123` instead of a string) returned `false` without throwing.
- 100,000 simulated resolutions of a 70/30-weighted A/B split landed at 70.1%/29.9%.
- Zero variants returned the base config completely untouched, confirming Phase 1/2 campaigns are unaffected.

Full script output is not committed (it was a temporary file, deleted after the run), but every one of the above was observed directly, not assumed. Separately, a temporary mock-data harness (same technique as Phase 2, deleted before shipping) confirmed the two new Builder tabs render, the rule-type picker correctly swaps between weekday/time/date/device fields, and the A/B tab correctly reuses the WhatsApp-specific config fields for a WhatsApp campaign.

## How to test locally (once you have real credentials)

1. Migrate (see "Migration" below), then `npm run db:seed`.
2. `npm run dev`, open `/dashboard/campaigns`, edit "Happy Hour Sexta" → **Regras** tab: no rules listed there directly (its schedule comes from the Detalhes tab's Recorrência field, translated automatically) — but note the campaign is only actually live Friday 18:00–22:00 America/Sao_Paulo now. Visit a VIP-zone card's `/r/[code]` outside that window: it falls back to the star-rating flow instead. Inside that window, it opens the WhatsApp invite.
3. Edit "Google Reviews VIP" → **Regras** tab shows one `DEVICE_TYPE` rule (Celular, Tablet). Visit Mesa VIP 1's `/r/[code]` from a desktop browser: since the rule excludes desktop, it falls through to the zone-level Happy Hour campaign (if in-window) or the star-rating flow — not Google Reviews. From a phone (or the browser's device emulation), it goes straight to Google Reviews.
4. Edit "Black Friday 2026" → **A/B** tab shows two variants ("Controle" 70%, "Variante — vídeo" 30%). Repeatedly visiting its assigned card's `/r/[code]` (during its Nov 27-30 2026 window) should redirect to one of the two URLs roughly in that proportion over many taps.
5. `/dev` and `/dev/ceo` reflect this phase.

## Files touched

**New:** `src/domain/rules/{timezone,evaluate,recurrence,variants}.ts`, `src/lib/validations/rule.ts`, `src/app/api/campaigns/[id]/rules/**`, `src/app/api/campaigns/[id]/variants/**`, `src/components/dashboard/campaigns/{rule-manager,variant-manager}.tsx`, `PHASE_3_REPORT.md`.

**Edited:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/resolution-engine/{types,data,resolve,index}.ts`, `src/app/r/[code]/page.tsx` (device-type parsing), `src/repositories/campaign.repository.ts` (rule/variant CRUD, dead-code removal), `src/services/campaign.service.ts` (rule/variant services, type-change guard), `src/components/dashboard/campaigns/campaign-builder-sheet.tsx` (two new tabs, corrected recurrence copy), `ROADMAP.md`, `TASKS.md`, `dev-status.json`.

## Migration

Same constraint as Phases 1-2: no `prisma/migrations/` history exists yet. If you've already migrated through Phase 2, this is a normal additive migration:

```bash
npx prisma migrate dev --name rule_engine_ab_testing
```

If you haven't migrated at all yet, follow Phase 1's full baseline procedure first. Nothing in this phase renames or removes an existing column (unlike Phase 2's `active` → `status`), so there's no data-mapping decision to make this time — purely additive: `Company.timezone` (new column, safe default), 3 new tables, 1 new nullable column on `RedirectLog`.

## Risks carried forward

- Rules are AND-only; no OR/rule-groups (see `ROADMAP.md` non-goals).
- No timezone picker UI — every company evaluates rules in `America/Sao_Paulo` until Settings gets a field for it.
- `RuleExecutionLog` rows from recurrence use a synthetic `ruleId` (`recurrence:<campaignId>:day`) that won't join back to a real `Rule` row — intentional, but worth knowing before Phase 7 builds analytics on top of this table.
- Same durability caveat as `RedirectLog`: `RuleExecutionLog` writes go through `after()` and can be lost on a hard crash — fine for an audit trail, not event sourcing.

## Next steps

Awaiting approval to start **Phase 4 — Multi-unit + RBAC v2**.
