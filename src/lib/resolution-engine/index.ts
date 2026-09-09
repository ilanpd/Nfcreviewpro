import "server-only";
import { cache } from "react";
import { after } from "next/server";
import {
  createRedirectLog,
  createRuleExecutionLogs,
  loadCardMeta,
  loadCompanyCampaigns,
  loadCompanyInfo,
  loadOrganizationCampaigns,
} from "./data";
import { cachedOrLoad, resolutionCacheKeys, resolutionCacheTtl } from "./cache";
import { resolveDecision } from "./resolve";
import { publishEvent } from "@/lib/event-bus";
import type { DeviceCategory } from "@/domain/rules/evaluate";
import type { ResolutionDecision } from "./types";

/**
 * The one function every caller uses — NFC taps today, QR/links/a public
 * API later (see ROADMAP.md). Wrapped in React.cache() so the same request
 * calling this from both generateMetadata and the page component only does
 * the underlying Redis/Postgres work once (both must pass the same
 * `deviceType` for that dedup to hit — see /r/[code]/page.tsx).
 *
 * `deviceType` is the only per-request input that isn't cacheable data (the
 * card/company/campaigns reads all still hit the same 3 Redis keys as
 * Phase 1/2 — device type never touches the cache layer at all, so DEVICE_TYPE
 * rules cost nothing extra in cache design, only in the pure decision step).
 */
export const resolveDestination = cache(async (uniqueCode: string, deviceType: DeviceCategory | null): Promise<ResolutionDecision> => {
  const cardResult = await cachedOrLoad(resolutionCacheKeys.card(uniqueCode), resolutionCacheTtl.card, () =>
    loadCardMeta(uniqueCode)
  );
  if (!cardResult.value) return { outcome: "NOT_FOUND" };

  const card = cardResult.value;
  const [companyResult, campaignsResult] = await Promise.all([
    cachedOrLoad(resolutionCacheKeys.company(card.companyId), resolutionCacheTtl.company, () =>
      loadCompanyInfo(card.companyId)
    ),
    cachedOrLoad(resolutionCacheKeys.campaigns(card.companyId), resolutionCacheTtl.campaigns, () =>
      loadCompanyCampaigns(card.companyId)
    ),
  ]);

  if (!companyResult.value) return { outcome: "NOT_FOUND" };

  const company = companyResult.value;

  // Only fetched when the company actually belongs to an Organization — a
  // company with organizationId=null (every company before Phase 4, and
  // every single-location business after it) never pays for this extra
  // read at all. See ADR-013/ADR-016.
  const organizationResult = company.organizationId
    ? await cachedOrLoad(
        resolutionCacheKeys.organizationCampaigns(company.organizationId),
        resolutionCacheTtl.organizationCampaigns,
        () => loadOrganizationCampaigns(company.organizationId!)
      )
    : { value: [], fromCache: true };

  // Campaigns are cached per-company (across all its cards/branches/zones) —
  // narrow to what applies to this specific card before handing off to
  // resolveDecision. BRANCH/ZONE match by direct equality against the
  // card's own branchId/zoneId — never null-matches-null, so a card with no
  // branch/zone assigned simply can't be targeted by a BRANCH/ZONE campaign.
  // ORGANIZATION-scope campaigns are already exact-matched by organizationId
  // at the query level (loadOrganizationCampaigns), so every row here is
  // relevant to this card by construction.
  const relevantAssignments = [...campaignsResult.value, ...organizationResult.value].filter((a) => {
    if (a.scope === "ORGANIZATION") return true;
    if (a.scope === "COMPANY") return true;
    if (a.scope === "CARD") return a.cardId === card.id;
    if (a.scope === "ZONE") return card.zoneId !== null && a.zoneId === card.zoneId;
    if (a.scope === "BRANCH") return card.branchId !== null && a.branchId === card.branchId;
    return false;
  });

  const { decision, ruleTrace } = resolveDecision(
    { card, company, assignments: relevantAssignments, deviceType },
    new Date()
  );

  const fromCache =
    cardResult.fromCache && companyResult.fromCache && campaignsResult.fromCache && organizationResult.fromCache;
  after(() => {
    createRedirectLog({
      companyId: card.companyId,
      cardId: card.id,
      campaignId: decision.outcome === "CAMPAIGN" ? decision.campaignId : null,
      variantId: decision.outcome === "CAMPAIGN" ? decision.variantId : null,
      outcome: decision.outcome === "CAMPAIGN" ? "CAMPAIGN" : "REVIEW_FLOW_FALLBACK",
      resolvedFromCache: fromCache,
    }).catch((err) => console.error("[resolution-engine] redirect log failed", err));

    createRuleExecutionLogs(card.companyId, card.id, ruleTrace).catch((err) =>
      console.error("[resolution-engine] rule execution log failed", err)
    );

    // Event Bus (Fase 8) — mesmo padrão best-effort/não-bloqueante dos dois
    // logs acima: o redirecionamento já foi para o ar antes desta linha
    // rodar (after() só executa depois da resposta ser enviada), então uma
    // falha aqui nunca atrasa nem afeta o cliente. NFCTocado e
    // RedirecionamentoResolvido são publicados juntos porque, hoje, todo
    // toque chega a uma resolução (não existe um "toque sem resolver" —
    // ver ADR-032 para o porquê de não haver um evento de toque isolado
    // mais cedo no fluxo).
    publishEvent("NFCTocado", { cardId: card.id, uniqueCode: card.uniqueCode }, { companyId: card.companyId }).catch(
      (err) => console.error("[resolution-engine] publish NFCTocado failed", err)
    );
    publishEvent(
      "RedirecionamentoResolvido",
      {
        cardId: card.id,
        campaignId: decision.outcome === "CAMPAIGN" ? decision.campaignId : null,
        variantId: decision.outcome === "CAMPAIGN" ? decision.variantId : null,
        outcome: decision.outcome === "CAMPAIGN" ? "CAMPAIGN" : "REVIEW_FLOW_FALLBACK",
        resolvedFromCache: fromCache,
      },
      { companyId: card.companyId }
    ).catch((err) => console.error("[resolution-engine] publish RedirecionamentoResolvido failed", err));
  });

  return decision;
});

export type { ResolutionDecision } from "./types";
