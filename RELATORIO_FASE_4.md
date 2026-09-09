> **Nota (Regra Permanente nº 1 — Fase 4.5):** este relatório foi escrito antes de o português se tornar o idioma oficial da documentação do projeto. Mantido em inglês por ser um registro histórico já entregue e aprovado; toda documentação a partir da Fase 4.5 é escrita em português. Renomeado de `PHASE_4_REPORT.md` para `RELATORIO_FASE_4.md` nesta fase.

# Phase 4 report — Multi-unit + RBAC v2

See `ROADMAP.md` for the full phase list and `TASKS.md` for the checklist this closes out. Also recorded per instruction, before any Phase 4 code: `ARCHITECTURE_DECISIONS.md` (ADR-001 through ADR-012, written retroactively for Phases 1-3) and a standing "Architect Review" section in `ROADMAP.md` — both now permanent project practice, not one-time deliverables.

## What was implemented

The product's data model and permission system are now shaped for national franchises, not just single-location restaurants — `Organization → Branch → Zone → NFC asset → Campaign Resolution Engine`, exactly as specified, without disturbing a single existing company's behavior.

- **Schema**: `Organization` (new top-level model, optional); `Company.organizationId` (nullable, additive — every existing company gets `null` and is unaffected); `Role` enum replaced (`OWNER`/`ADMIN`/`MARKETING`/`MANAGER`/`OPERATOR`/`READ_ONLY`, `STAFF`→`OPERATOR` on migration); `TargetScope` gained `ORGANIZATION` (least specific, ranked below `COMPANY`); `UserAccessScope` (opt-in branch/zone restriction, zero rows = unrestricted); `AuditLog`/`AuditAction` (who/when/from-where for high-value mutations); `CampaignAssignment.organizationId` (the one field in the whole schema that intentionally crosses `companyId` boundaries).
- **Domain layer**:
  - `domain/rbac/roles.ts` — a flat `Permission` capability list and a `Record<Role, Set<Permission>>` matrix, not a role hierarchy. `requirePermission(ctx, permission)` replaces role-list checks everywhere this phase touched.
  - `domain/rbac/scope.ts` — `isWithinScope()`: zero restriction rows means unrestricted (the compatibility guarantee), one or more rows narrow a user to only those branches/zones, with a branch-level row implying every zone under it.
  - `domain/audit/labels.ts` — pt-BR display labels for `AuditAction`.
  - `domain/campaign/assignment.ts` extended: `ORGANIZATION` scope validation, specificity ranking, and label.
- **`lib/auth.ts`**: `AuthContext` gained `organizationId` and `accessScopes`, both folded into the existing single `prisma.user.findUnique` call via a shared `AUTH_USER_SELECT` — no second query added to the single most-frequently-executed code path in the app. `requirePermission()` and `requireScopeAccess()` added alongside the pre-existing `requireRole()`.
- **Services**:
  - `organization.service.ts` — create (wraps the acting company, blocks if it already belongs to one), get (with member companies), rename.
  - `audit.service.ts` — `recordAudit(ctx, action, {targetId, metadata})`, called from route handlers after a mutation already succeeded (see ADR-017), plus `listAuditLogs()` for the Settings view.
  - `team.service.ts` gained `listAccessScopes`/`grantAccessScope`/`revokeAccessScope`.
  - `campaign.service.ts`'s `assignCampaign` now takes the full `AuthContext` (not just `companyId`): validates `ORGANIZATION`-scope targets against the acting company's own organization, enforces `requireScopeAccess` for `BRANCH`/`ZONE`/`CARD` targets, and blocks `COMPANY`/`ORGANIZATION`-scope assignment entirely for any scope-restricted user (neither restriction shape could express "the whole company/organization" anyway). `unassignCampaign` got the symmetric check.
- **API routes**: `POST/GET /api/organization`, `PATCH /api/organization`; `GET/POST /api/team/[id]/access-scopes`, `DELETE /api/team/[id]/access-scopes/[scopeId]`. Every pre-existing campaign/team/branch/zone/company route (12 files) swept from `requireRole(ctx, ["OWNER","ADMIN"])` to the matching `requirePermission(ctx, "...")` call — see "Proactive fixes" below for why this wasn't optional.
- **Resolution engine**: `loadOrganizationCampaigns(organizationId)` in `resolution-engine/data.ts` — the one query in the entire engine that filters by `organizationId` instead of `companyId`, by design (ADR-013). Its own cache key/TTL (`resolutionCacheKeys.organizationCampaigns`, ADR-016), invalidated via `invalidateOrganizationCampaigns()`. `index.ts` fetches it conditionally — only when `company.organizationId` is non-null — and merges the result into the candidate pool alongside `COMPANY`/`BRANCH`/`ZONE`/`CARD` matches before handing off to the unchanged `resolveDecision()`.
- **Dashboard UI**:
  - `AssignmentManager` gained the `ORGANIZATION` scope end-to-end (icon, Select option, target-label rendering, request body construction) — shown only when the company actually belongs to an organization. A new `canManageStructure` prop (distinct from `campaign:assign`) gates the inline branch/zone quick-create, since creating new organizational structure is a settings-level action a Marketing/Manager user shouldn't get for free just by being able to assign campaigns.
  - `TeamView` migrated to the 6-role set (`ASSIGNABLE_ROLES`/`ROLE_LABEL` from the domain layer, not a local copy) and gained a per-member "Acesso" column opening `AccessScopeManager`.
  - `OrganizationCard` (create-or-view) and `AuditLogCard` (last 50 actions) added to `/dashboard/settings`, both permission-gated (`organization:write`, `audit:read`).
- **Seed**: `Organization` "Rede Bella Vista" now wraps the existing Bella Vista company; a second company, "Bella Vista Shopping" (its own `Branch` "Shopping Morumbi", `Zone` "Praça de Alimentação", one card), demonstrates a real second franchise unit; an `ORGANIZATION`-scope "Programa de Fidelidade" campaign resolves on cards from *both* companies; a `MANAGER` user restricted to the VIP zone via `UserAccessScope` demonstrates the restriction model with a real, non-trivial example.

## Proactive fixes found during this phase (Architect Review, not requested)

Per the newly-institutionalized standing review (`ROADMAP.md`), before this report was written:

1. **A real authorization gap, not just a code-quality issue.** Every campaign/team/branch/zone/company API route still used the old `requireRole(ctx, ["OWNER", "ADMIN"])` check, while the dashboard UI already computed `canManage` from the new `roleHasPermission(ctx.role, "campaign:write")`. Since `MARKETING` and `MANAGER` both hold `campaign:write` in the new matrix, either role would see a fully-enabled "manage campaigns" UI — create button, edit, assign — and get a 403 from the API the moment they used it. Fixed across 12 route files (`campaigns`, `campaigns/[id]`, `archive`, `duplicate`, `assignments`, `rules`, `variants`, `team`, `company`, `branches`, `zones`), each moved to the matching `requirePermission(ctx, "...")` call. `team`/`company`/`branches`/`zones` had no behavior change (only `OWNER`/`ADMIN` hold those permissions today), but now read from the same single source of truth as everything else instead of a second, driftable hardcoded list.
2. **Two missing scope-access checks in `assignCampaign`.** `CARD`-scope assignment checked the card existed but never checked it against the acting user's access-scope restriction — a `Manager` restricted to Zone VIP could have assigned a campaign to a card in a completely different zone. Separately, nothing stopped a scope-restricted user from picking `COMPANY` or `ORGANIZATION` scope at all — both reach further than any branch/zone restriction could possibly express, which defeats the entire point of restricting them. Both fixed: `CARD` now checks the card's own `branchId`/`zoneId` against `requireScopeAccess`; `COMPANY`/`ORGANIZATION` scope is now rejected outright for any user with one or more `UserAccessScope` rows. `unassignCampaign` received the same three checks, so a restricted user can't remove an assignment they couldn't have created in the first place (including looking up the card's branch/zone for a `CARD`-scope assignment being removed, since the assignment row itself doesn't carry that).
3. **The `ORGANIZATION` scope inherited Phase 2's known race, silently.** ADR-007 (Phase 2) documented that Postgres's "NULLs are distinct" default means the `@@unique` constraint on `CampaignAssignment` doesn't stop duplicate `COMPANY`-scope rows per campaign — closed with a Serializable-transaction check-then-insert. `ORGANIZATION`-scope rows have exactly the same shape (`branchId`/`zoneId`/`cardId` all null), so they have exactly the same gap — not caught until this review, since the transaction's duplicate guard only checked `COMPANY`. Extended to cover both scopes inside the same transaction; the schema comment was updated to describe both, not just `COMPANY`.
4. **Checked for N+1s and found none introduced.** The auth-context expansion (`organizationId` + `accessScopes`) rides the existing single `findUnique` via a shared select object — verified by reading `lib/auth.ts` directly, not assumed. The organization-campaigns cache fetch in the resolution engine is conditional on `company.organizationId` being non-null, so the overwhelming majority of companies (every one without an organization) pay zero extra latency, zero extra queries, and zero extra cache reads for this feature.

## How this was verified (not just typed)

- All four quality gates — `tsc --noEmit`, `eslint`, `prisma validate`, `npm run build` (placeholder `.env.local`, cleaned up after) — pass cleanly, re-run after every batch of fixes above, not just once at the end.
- Interactive smoke test via a temporary mock-data harness at `src/app/dev/harness-phase4` (deleted before shipping). Since this sandbox has no live Clerk instance, `src/middleware.ts` was temporarily reduced to an empty matcher for the duration of the check and restored immediately after (verified via a fresh `git`-equivalent diff read, not just memory) — the harness page itself needed no Clerk bypass beyond that, since it renders the components directly with mock props rather than going through `requireAuthContext()`. Confirmed via the browser's accessibility tree (screenshots were unavailable in this sandbox — the pane wouldn't render a capture, so `read_page`/`get_page_text`/click-and-reread was used instead):
  - The scope `Select` correctly offers 5 options ("Toda a organização", "Empresa inteira", "Unidade", "Zona", "Cartão específico") when `organizationId` is set, and correctly omits `ORGANIZATION` when it's `null`.
  - `canManageStructure={false}` correctly hides the inline branch/zone quick-add button while still showing the target picker; `canManageStructure={true}` correctly shows it, and clicking it correctly swaps in the "Criar" text input.
  - `OrganizationCard` renders its create-form empty state and its populated (name + member companies) state correctly.
  - `AuditLogCard` renders a list of dated, labeled entries correctly.
- **What I cannot prove**: real multi-tenant load behavior, and that the real migration applies cleanly against production Supabase — same stated limitation as every prior phase, no live Postgres/Redis/Clerk in this sandbox.

## How to test locally (once you have real credentials)

1. Migrate (see "Migration" below), then `npm run db:seed`.
2. Sign in as `owner@demo.com` (Bella Vista). `/dashboard/settings` now shows an "Organização" card — since the seed already wraps Bella Vista in "Rede Bella Vista," it shows both member companies (Bella Vista, Bella Vista Shopping) instead of the create form.
3. `/dashboard/team` — invite a member, pick a role from the new 6-role list; for any non-Owner member, click the shield icon to open the access-scope manager and restrict them to a branch or zone.
4. `/dashboard/campaigns` — open "Programa de Fidelidade" (seeded `ORGANIZATION`-scope), Atribuições tab: shows "Toda a organização." Visit any card's `/r/[code]` on **either** Bella Vista or Bella Vista Shopping — both should be eligible for this campaign (lower priority than more specific campaigns, so it only wins where nothing more specific applies).
5. Sign in as the seeded `gerente-vip@demo.com` (Manager, restricted to the VIP zone): in Campaign Builder's assignment tab, `COMPANY`/`ORGANIZATION` scope options should be rejected server-side if attempted (not currently hidden client-side — a nice follow-up, not done this phase), and `BRANCH`/`ZONE`/`CARD` assignment should only succeed for VIP-zone targets.
6. `/dev` and `/dev/ceo` reflect this phase.

## Files touched

**New:** `ARCHITECTURE_DECISIONS.md`, `src/domain/rbac/{roles,scope}.ts`, `src/domain/audit/labels.ts`, `src/services/{organization,audit}.service.ts`, `src/lib/validations/organization.ts`, `src/app/api/organization/route.ts`, `src/app/api/team/[id]/access-scopes/route.ts`, `src/app/api/team/[id]/access-scopes/[scopeId]/route.ts`, `src/components/dashboard/{organization-card,audit-log-card}.tsx`, `PHASE_4_REPORT.md`.

**Edited:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/auth.ts`, `src/lib/validations/{team,campaign}.ts`, `src/domain/campaign/assignment.ts`, `src/services/{campaign,team}.service.ts`, `src/lib/resolution-engine/{types,data,cache,index}.ts`, `src/app/dashboard/{campaigns,team,settings}/page.tsx`, `src/components/dashboard/{team-view,access-scope-manager}.tsx`, `src/components/dashboard/campaigns/{assignment-manager,campaign-builder-sheet,campaigns-view,campaign-row}.tsx`, every route file listed in "Proactive fixes" #1 above, `ROADMAP.md`, `TASKS.md`, `dev-status.json`.

## Migration

No `prisma/migrations/` history exists yet — same constraint as every prior phase. This phase includes a **breaking rename**, like Phase 2's `active` → `status`: the `Role` enum's values changed (`STAFF` no longer exists; existing rows must map to `OPERATOR`). If you've migrated through Phase 3 already:

```bash
# 1. Back up first — this phase changes an enum's value set, not just adds columns.
# 2. If any real User rows exist with role=STAFF, update them before migrating:
#    UPDATE "User" SET role = 'OPERATOR' WHERE role = 'STAFF';
npx prisma migrate dev --name multi_unit_rbac_v2
```

If you haven't migrated at all yet, follow Phase 1's full baseline procedure first, then apply this phase's migration on top. Since this is still pre-launch (no real Supabase data confirmed to exist), the `STAFF`→`OPERATOR` mapping was treated as a one-time schema default rather than a guarded data-migration script — re-evaluate that decision if real user data now exists in your database.

## Risks carried forward

- Sub-100ms resolution latency and the organization-campaigns cache's real hit rate are design goals, not measured — no live Postgres/Redis in this dev sandbox.
- `AuditLog` only captures mutations made through an authenticated dashboard route (see ADR-017) — a future script or queue worker calling a service function directly would not be logged.
- No UI yet for adding an *additional* company to an existing Organization — this phase ships creating a new organization from a company that has none. A second company joining later would need a support/API-level action for now.
- The dashboard doesn't yet hide `COMPANY`/`ORGANIZATION` scope options client-side for a scope-restricted user in the Assignment Manager — they're correctly rejected server-side (see Proactive fix #2), but a restricted user would see the option, pick it, and get an error message rather than never seeing it. Cosmetic, not a security gap.
- Same durability caveat as `RedirectLog`/`RuleExecutionLog`: nothing about audit logging changes that — `recordAudit` is a direct `await`ed write on the authenticated path (not `after()`), so it's more durable than those, but still best-effort or best-effort against transient DB errors (logged, never allowed to fail the underlying request).

## Next steps

Phase 4.5 (Enterprise Design System & MCP Integration) is scoped in `ROADMAP.md` but explicitly not implemented, per instruction. Awaiting approval to start it, or to reprioritize to Phase 5 (Table Map) instead.
