/**
 * Isolamento entre empresas (IDOR/BOLA), contra um banco REAL.
 *
 * O app conecta ao banco como o dono das tabelas, que ignora o RLS: a fronteira entre uma empresa e outra
 * é o código (toda operação busca por `id + companyId`). Este teste cria DUAS empresas de teste e tenta, como
 * a empresa A, ler, alterar, apagar, duplicar e vincular recursos da empresa B pelos serviços que as rotas
 * chamam. Cada tentativa tem de ser recusada E os dados de B têm de continuar intactos. Controles positivos
 * provam que a mesma operação funciona no que é da própria A (senão uma recusa poderia ser um teste quebrado).
 *
 * Só roda com `RUN_DB_SECURITY_TESTS=1` e SEMPRE no banco de STAGING (recusa qualquer outro). Rode com:
 *   node scripts/test-security-db.mjs
 * Apaga as duas empresas ao terminar.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assertStagingDatabase, DB_TESTS_ENABLED, newRunId } from "./staging-db";

vi.mock("server-only", () => ({}));

async function load() {
  assertStagingDatabase(); // recusa qualquer banco que não seja o de Staging
  const [{ prisma }, card, campaign, zone, branch, team, apiKey, webhook, feedback] = await Promise.all([
    import("@/lib/prisma"),
    import("@/services/card.service"),
    import("@/services/campaign.service"),
    import("@/services/zone.service"),
    import("@/services/branch.service"),
    import("@/services/team.service"),
    import("@/services/api-key.service"),
    import("@/services/webhook-endpoint.service"),
    import("@/services/feedback.service"),
  ]);
  return { prisma, card, campaign, zone, branch, team, apiKey, webhook, feedback };
}

type Mods = Awaited<ReturnType<typeof load>>;
interface Tenant {
  companyId: string;
  userId: string;
  branchId: string;
  zoneId: string;
  cardIds: string[];
  campaignId: string;
  ruleId: string;
  variantId: string;
  assignmentId: string;
  memberId: string;
  apiKeyId: string;
  endpointId: string;
  feedbackId: string;
}

const RUN = newRunId();

async function seed(m: Mods, label: "A" | "B"): Promise<Tenant> {
  const company = await m.prisma.company.create({
    data: { name: `Teste Seguranca ${label} ${RUN}`, slug: `${RUN}-${label.toLowerCase()}`, plan: "BUSINESS", accountType: "CUSTOMER" },
  });
  const owner = await m.prisma.user.create({
    data: { companyId: company.id, email: `dono-${label.toLowerCase()}@${RUN}.example.com`, name: `Dono ${label}`, role: "OWNER", status: "ACTIVE", clerkId: `clerk_${RUN}_${label}` },
  });
  const branch = await m.branch.createBranch(company.id, `Filial ${label}`);
  const zone = await m.zone.createZone(company.id, `Zona ${label}`, branch.id);
  const card1 = await m.card.createCard(company.id, { name: `Cartao ${label} 1`, tags: [] });
  const card2 = await m.card.createCard(company.id, { name: `Cartao ${label} 2`, tags: [] });
  const campaign = await m.campaign.createCampaign(company.id, {
    name: `Campanha ${label}`,
    type: "URL_REDIRECT",
    priority: 0,
    recurrenceType: "NONE",
    tags: [],
    config: { url: "https://exemplo.com.br/destino" },
  } as never);
  // B ganha regra, variante e vínculo reais: assim "A não vê nada" prova algo (listar o que não existe também dá vazio).
  const rule = await m.campaign.createRule(company.id, campaign.id, { type: "DAY_OF_WEEK", config: { days: [1, 2] } } as never);
  const variant = await m.campaign.createVariant(company.id, campaign.id, { name: `Variante ${label}`, weight: 50, config: { url: "https://exemplo.com.br/variante" } } as never);
  const assignment = await m.prisma.campaignAssignment.create({ data: { companyId: company.id, campaignId: campaign.id, scope: "CARD", cardId: card2.id } });
  const member = await m.team.inviteMember(company.id, { email: `membro-${label.toLowerCase()}@${RUN}.example.com`, name: `Membro ${label}`, role: "MANAGER" } as never);
  const key = await m.apiKey.createApiKey(company.id, owner.id, { name: `Chave ${label}`, scopes: ["cards:read"] });
  const endpoint = await m.webhook.createWebhookEndpoint(company.id, { url: `https://hooks.exemplo.com.br/${label}`, events: ["card.tapped"] });
  const fb = await m.prisma.privateFeedback.create({ data: { companyId: company.id, message: `Mensagem privada de ${label}` } });
  return {
    companyId: company.id,
    userId: owner.id,
    branchId: branch.id,
    zoneId: zone.id,
    cardIds: [card1.id, card2.id],
    campaignId: campaign.id,
    ruleId: rule.id,
    variantId: variant.id,
    assignmentId: assignment.id,
    memberId: member.id,
    apiKeyId: key.apiKey.id,
    endpointId: endpoint.id,
    feedbackId: fb.id,
  };
}

describe.skipIf(!DB_TESTS_ENABLED)("isolamento entre empresas (banco de Staging)", () => {
  let m: Mods;
  let A: Tenant;
  let B: Tenant;
  const ctxA = () =>
    ({ userId: A.userId, companyId: A.companyId, organizationId: null, role: "OWNER", email: "dono-a@x", plan: "BUSINESS", access: { level: "FULL" }, accessScopes: [] }) as never;

  beforeAll(async () => {
    m = await load();
    A = await seed(m, "A");
    B = await seed(m, "B");
  }, 120_000);

  afterAll(async () => {
    if (!m) return;
    // Por prefixo do slug desta rodada: limpa também o que ficou pela metade se o preparo falhou no meio.
    await m.prisma.company.deleteMany({ where: { slug: { startsWith: RUN } } }).catch((e) => console.error("limpeza falhou", e));
    await m.prisma.$disconnect();
  }, 60_000);

  /** Cada tentativa de A sobre algo de B. TODAS têm de lançar erro. */
  const attacks: [string, () => Promise<unknown>][] = [
    // cartões
    ["ler cartão de B", () => m.card.getCardForCompany(A.companyId, B.cardIds[0])],
    ["renomear cartão de B", () => m.card.updateCard(A.companyId, B.cardIds[0], { name: "invadido" } as never)],
    ["apagar cartão de B", () => m.card.deleteCard(A.companyId, B.cardIds[0])],
    ["mover o layout de um cartão de B", () => m.card.updateCardLayout(A.companyId, B.cardIds[0], { layoutX: 1, layoutY: 1 } as never)],
    ["mover em lote cartões de B", () => m.card.bulkUpdateCardLayout(A.companyId, { updates: [{ id: B.cardIds[0], layoutX: 5, layoutY: 5 }] } as never)],
    ["mover em lote um cartão de A MISTURADO com um de B", () => m.card.bulkUpdateCardLayout(A.companyId, { updates: [{ id: A.cardIds[0], layoutX: 9, layoutY: 9 }, { id: B.cardIds[0], layoutX: 9, layoutY: 9 }] } as never)],
    ["duplicar cartão de B", () => m.card.duplicateCard(A.companyId, B.cardIds[0])],
    ["apontar cartão de A para a filial de B", () => m.card.updateCard(A.companyId, A.cardIds[0], { branchId: B.branchId } as never)],
    ["apontar cartão de A para a zona de B", () => m.card.updateCard(A.companyId, A.cardIds[0], { zoneId: B.zoneId } as never)],
    // campanhas
    ["ler campanha de B", () => m.campaign.getCampaign(A.companyId, B.campaignId)],
    ["editar campanha de B", () => m.campaign.updateCampaign(A.companyId, B.campaignId, { name: "invadida" } as never)],
    ["arquivar campanha de B", () => m.campaign.archiveCampaign(A.companyId, B.campaignId)],
    ["duplicar campanha de B", () => m.campaign.duplicateCampaign(A.companyId, B.campaignId)],
    ["apagar campanha de B", () => m.campaign.deleteCampaign(A.companyId, B.campaignId)],
    ["criar regra na campanha de B", () => m.campaign.createRule(A.companyId, B.campaignId, { type: "DAY_OF_WEEK", config: { days: [3] } } as never)],
    ["apagar a regra de B", () => m.campaign.deleteRule(A.companyId, B.ruleId)],
    ["criar variante na campanha de B", () => m.campaign.createVariant(A.companyId, B.campaignId, { name: "x", weight: 50, config: { url: "https://exemplo.com.br/x" } } as never)],
    ["apagar a variante de B", () => m.campaign.deleteVariant(A.companyId, B.variantId)],
    ["remover o vínculo de B", () => m.campaign.unassignCampaign(ctxA(), B.assignmentId)],
    ["vincular campanha de B a um cartão de A", () => m.campaign.assignCampaign(ctxA(), B.campaignId, { scope: "CARD", cardId: A.cardIds[0] } as never)],
    ["vincular campanha de A a um cartão de B", () => m.campaign.assignCampaign(ctxA(), A.campaignId, { scope: "CARD", cardId: B.cardIds[0] } as never)],
    ["vincular campanha de A à zona de B", () => m.campaign.assignCampaign(ctxA(), A.campaignId, { scope: "ZONE", zoneId: B.zoneId } as never)],
    // filiais e zonas
    ["ler filial de B", () => m.branch.getBranch(A.companyId, B.branchId)],
    ["renomear filial de B", () => m.branch.updateBranch(A.companyId, B.branchId, "invadida")],
    ["apagar filial de B", () => m.branch.deleteBranch(A.companyId, B.branchId)],
    ["ler zona de B", () => m.zone.getZone(A.companyId, B.zoneId)],
    ["renomear zona de B", () => m.zone.updateZone(A.companyId, B.zoneId, { name: "invadida" })],
    ["mover zona de B para a filial de A", () => m.zone.updateZone(A.companyId, B.zoneId, { branchId: A.branchId })],
    ["apagar zona de B", () => m.zone.deleteZone(A.companyId, B.zoneId)],
    ["criar zona de A dentro da filial de B", () => m.zone.createZone(A.companyId, "x", B.branchId)],
    ["mover a zona de A para a filial de B", () => m.zone.updateZone(A.companyId, A.zoneId, { branchId: B.branchId })],
    // equipe
    ["mudar o papel de um membro de B", () => m.team.updateMemberRole(A.companyId, B.memberId, { role: "ADMIN" } as never)],
    ["remover um membro de B", () => m.team.removeMember(A.companyId, B.memberId, "OWNER")],
    ["conceder restrição de acesso a um membro de B", () => m.team.grantAccessScope(A.companyId, B.memberId, { branchId: A.branchId } as never)],
    ["restringir um membro de A à filial de B", () => m.team.grantAccessScope(A.companyId, A.memberId, { branchId: B.branchId } as never)],
    ["restringir um membro de A à zona de B", () => m.team.grantAccessScope(A.companyId, A.memberId, { zoneId: B.zoneId } as never)],
    // chaves de API
    ["revogar chave de API de B", () => m.apiKey.revokeApiKey(A.companyId, B.apiKeyId)],
    // webhooks
    ["ler webhook de B", () => m.webhook.getWebhookEndpoint(A.companyId, B.endpointId)],
    ["trocar a URL do webhook de B", () => m.webhook.updateWebhookEndpoint(A.companyId, B.endpointId, { url: "https://evil.example.com/x" })],
    ["apagar webhook de B", () => m.webhook.deleteWebhookEndpoint(A.companyId, B.endpointId)],
    ["listar entregas do webhook de B", () => m.webhook.listWebhookDeliveries(A.companyId, B.endpointId)],
    ["reenviar entrega do webhook de B", () => m.webhook.replayWebhookDelivery(A.companyId, B.endpointId, "qualquer")],
    // feedback privado
    ["resolver feedback privado de B", () => m.feedback.setFeedbackResolved(A.companyId, B.feedbackId, true)],
  ];

  it.each(attacks)("RECUSA: A tenta %s", async (_nome, attack) => {
    await expect(attack()).rejects.toThrow();
  }, 30_000);

  /** Listagens "por id da campanha alheia": ou recusam ou devolvem VAZIO (B tem 1 item de cada, então vazio prova o filtro). */
  const scopedLists: [string, () => Promise<unknown[]>][] = [
    ["vínculos da campanha de B", () => m.campaign.listAssignments(A.companyId, B.campaignId) as Promise<unknown[]>],
    ["regras da campanha de B", () => m.campaign.listRules(A.companyId, B.campaignId) as Promise<unknown[]>],
    ["variantes da campanha de B", () => m.campaign.listVariants(A.companyId, B.campaignId) as Promise<unknown[]>],
  ];
  it.each(scopedLists)("A lista %s e NÃO recebe nada", async (_nome, list) => {
    const rows = await list().catch(() => [] as unknown[]);
    expect(rows).toHaveLength(0);
  });

  it("desfazer em lote o vínculo de B pela empresa A não apaga nada", async () => {
    expect(await m.campaign.undoBulkAssignment(A.companyId, [B.assignmentId])).toEqual({ deleted: 0 });
  });

  it("(controle) B de fato tem regra, variante e vínculo, ou seja, o vazio acima é filtro e não ausência de dados", async () => {
    expect((await m.campaign.listRules(B.companyId, B.campaignId)).map((r) => r.id)).toEqual([B.ruleId]);
    expect((await m.campaign.listVariants(B.companyId, B.campaignId)).map((r) => r.id)).toEqual([B.variantId]);
    expect((await m.campaign.listAssignments(B.companyId, B.campaignId)).map((r) => r.id)).toEqual([B.assignmentId]);
  });

  it("os dados de B continuam INTACTOS depois de todas as tentativas", async () => {
    const [cards, campaign, branch, zone, member, key, endpoint, fb] = await Promise.all([
      m.prisma.nFCCard.findMany({ where: { id: { in: B.cardIds } }, orderBy: { name: "asc" } }),
      m.prisma.campaign.findUnique({ where: { id: B.campaignId } }),
      m.prisma.branch.findUnique({ where: { id: B.branchId } }),
      m.prisma.zone.findUnique({ where: { id: B.zoneId } }),
      m.prisma.user.findUnique({ where: { id: B.memberId } }),
      m.prisma.apiKey.findUnique({ where: { id: B.apiKeyId } }),
      m.prisma.webhookEndpoint.findUnique({ where: { id: B.endpointId } }),
      m.prisma.privateFeedback.findUnique({ where: { id: B.feedbackId } }),
    ]);
    expect(cards.map((c) => c.name)).toEqual(["Cartao B 1", "Cartao B 2"]);
    expect(cards.every((c) => c.companyId === B.companyId && c.branchId === null && c.zoneId === null && c.layoutX === null)).toBe(true);
    expect(campaign).toMatchObject({ name: "Campanha B", status: "DRAFT", companyId: B.companyId });
    expect(branch?.name).toBe("Filial B");
    expect(zone).toMatchObject({ name: "Zona B", branchId: B.branchId });
    expect(member).toMatchObject({ role: "MANAGER", companyId: B.companyId });
    expect(key?.revokedAt).toBeNull();
    expect(endpoint).toMatchObject({ url: "https://hooks.exemplo.com.br/B", active: true });
    expect(fb?.resolved).toBe(false);
    // nada novo apareceu em B (regras, variantes, vínculos, cópias)
    const [rules, variants, assigns, copies] = await Promise.all([
      m.prisma.rule.count({ where: { campaignId: B.campaignId } }),
      m.prisma.campaignVariant.count({ where: { campaignId: B.campaignId } }),
      m.prisma.campaignAssignment.count({ where: { OR: [{ companyId: B.companyId }, { campaignId: B.campaignId }] } }),
      m.prisma.nFCCard.count({ where: { companyId: B.companyId } }),
    ]);
    expect([rules, variants, assigns, copies]).toEqual([1, 1, 1, 2]);
  });

  it("os dados de A também ficaram como estavam (nenhuma tentativa pela metade gravou algo)", async () => {
    const cards = await m.prisma.nFCCard.findMany({ where: { id: { in: A.cardIds } }, orderBy: { name: "asc" } });
    expect(cards.map((c) => [c.name, c.branchId, c.zoneId, c.layoutX])).toEqual([
      ["Cartao A 1", null, null, null],
      ["Cartao A 2", null, null, null],
    ]);
    const assigns = await m.prisma.campaignAssignment.findMany({ where: { companyId: A.companyId }, select: { id: true } });
    expect(assigns.map((a) => a.id)).toEqual([A.assignmentId]); // só o que foi semeado: nenhum vínculo novo apareceu
    expect(await m.prisma.zone.count({ where: { companyId: A.companyId } })).toBe(1);
  });

  it("as LISTAGENS de A nunca trazem nada de B", async () => {
    const [cards, campaigns, branches, zones, members, keys, endpoints, feedbacks] = await Promise.all([
      m.card.listCards(A.companyId),
      m.campaign.listCampaigns(A.companyId, {} as never),
      m.branch.listBranches(A.companyId),
      m.zone.listZones(A.companyId),
      m.team.listMembers(A.companyId),
      m.apiKey.listApiKeys(A.companyId),
      m.webhook.listWebhookEndpoints(A.companyId),
      m.feedback.listFeedback(A.companyId),
    ]);
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
    expect(ids(cards)).not.toEqual(expect.arrayContaining([B.cardIds[0]]));
    expect(ids(cards).sort()).toEqual([...A.cardIds].sort());
    expect(ids(campaigns)).toEqual([A.campaignId]);
    expect(ids(branches)).toEqual([A.branchId]);
    expect(ids(zones)).toEqual([A.zoneId]);
    expect(ids(members)).not.toContain(B.memberId);
    expect(ids(keys)).toEqual([A.apiKeyId]);
    expect(ids(endpoints)).toEqual([A.endpointId]);
    expect(ids(feedbacks)).toEqual([A.feedbackId]);
  });

  describe("controles positivos: a MESMA operação funciona no que é da própria A", () => {
    it("A edita o próprio cartão, campanha, filial, zona e feedback", async () => {
      expect((await m.card.updateCard(A.companyId, A.cardIds[1], { name: "Cartao A editado" } as never)).name).toBe("Cartao A editado");
      expect((await m.campaign.updateCampaign(A.companyId, A.campaignId, { name: "Campanha A editada" } as never)).name).toBe("Campanha A editada");
      expect((await m.branch.updateBranch(A.companyId, A.branchId, "Filial A editada")).name).toBe("Filial A editada");
      expect((await m.zone.updateZone(A.companyId, A.zoneId, { name: "Zona A editada" })).name).toBe("Zona A editada");
      expect((await m.feedback.setFeedbackResolved(A.companyId, A.feedbackId, true)).resolved).toBe(true);
    });

    it("A vincula a própria campanha ao próprio cartão", async () => {
      await expect(m.campaign.assignCampaign(ctxA(), A.campaignId, { scope: "CARD", cardId: A.cardIds[0] } as never)).resolves.toBeTruthy();
    });

    it("A revoga a própria chave e atualiza o próprio webhook", async () => {
      expect((await m.apiKey.revokeApiKey(A.companyId, A.apiKeyId)).revokedAt).not.toBeNull();
      expect((await m.webhook.updateWebhookEndpoint(A.companyId, A.endpointId, { active: false })).active).toBe(false);
    });
  });
});
