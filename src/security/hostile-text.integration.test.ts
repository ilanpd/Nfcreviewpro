/**
 * Texto hostil contra o banco REAL (Staging): tentativas de injeção de SQL e de script entram pelos serviços que as
 * rotas chamam e têm de ser tratadas como DADOS: gravadas e lidas de volta idênticas, sem alterar o resultado de
 * nenhuma consulta e sem tocar nas tabelas. Uma consulta montada por concatenação devolveria TODAS as linhas num
 * `' OR 1=1` ou perderia a tabela num `DROP TABLE`; aqui o resultado tem de ser exatamente o esperado.
 *
 * Só roda com `RUN_DB_SECURITY_TESTS=1` (`node scripts/test-security-db.mjs`). Apaga a empresa de teste ao terminar.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assertStagingDatabase, DB_TESTS_ENABLED, newRunId } from "./staging-db";

vi.mock("server-only", () => ({}));

const RUN = newRunId();
const SQLI = [`'; DROP TABLE "NFCCard"; --`, `" OR 1=1 --`, `' UNION SELECT "id" FROM "Company" --`, `%' OR '1'='1`, `\\'; DELETE FROM "Company"; --`];
const XSS = [`<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, `<svg/onload=alert(1)>`, `javascript:alert(1)`, `{{constructor.constructor('alert(1)')()}}`];
const PAYLOADS = [...SQLI, ...XSS];

describe.skipIf(!DB_TESTS_ENABLED)("texto hostil é tratado como dado (banco de Staging)", () => {
  let prisma: Awaited<typeof import("@/lib/prisma")>["prisma"];
  let card: typeof import("@/services/card.service");
  let campaign: typeof import("@/services/campaign.service");
  let branch: typeof import("@/services/branch.service");
  let companyId = "";

  beforeAll(async () => {
    assertStagingDatabase();
    ({ prisma } = await import("@/lib/prisma"));
    card = await import("@/services/card.service");
    campaign = await import("@/services/campaign.service");
    branch = await import("@/services/branch.service");
    const company = await prisma.company.create({ data: { name: `Teste Seguranca Texto ${RUN}`, slug: `${RUN}-t`, plan: "BUSINESS", accountType: "CUSTOMER" } });
    companyId = company.id;
    await campaign.createCampaign(companyId, { name: "Campanha Normal", type: "URL_REDIRECT", priority: 0, recurrenceType: "NONE", tags: [], config: { url: "https://exemplo.com.br/a" } } as never);
    await campaign.createCampaign(companyId, { name: "Outra Campanha", type: "URL_REDIRECT", priority: 0, recurrenceType: "NONE", tags: [], config: { url: "https://exemplo.com.br/b" } } as never);
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.company.deleteMany({ where: { slug: { startsWith: RUN } } }).catch((e) => console.error("limpeza falhou", e));
    await prisma.$disconnect();
  }, 60_000);

  it.each(PAYLOADS)("nome de cartão e de filial: gravado e lido de volta IDÊNTICO: %s", async (payload) => {
    const created = await card.createCard(companyId, { name: payload, tags: [payload] });
    const back = await card.getCardForCompany(companyId, created.id);
    expect(back.name).toBe(payload);
    expect(back.tags).toEqual([payload]);

    const b = await branch.createBranch(companyId, payload);
    expect((await branch.getBranch(companyId, b.id)).name).toBe(payload);
  });

  it.each(PAYLOADS)("busca de campanha com %s não vaza nem apaga nada", async (payload) => {
    const found = await campaign.listCampaigns(companyId, { search: payload } as never);
    expect(found).toHaveLength(0); // a injeção devolveria as 2 campanhas (ou todas as do banco)
  });

  it("controle: a busca normal acha só o que casa", async () => {
    expect(await campaign.listCampaigns(companyId, { search: "normal" } as never)).toHaveLength(1);
    expect(await campaign.listCampaigns(companyId, { search: "campanha" } as never)).toHaveLength(2);
  });

  it("depois de tudo: as tabelas existem, nenhuma outra empresa foi tocada e as contagens batem", async () => {
    expect(await prisma.nFCCard.count({ where: { companyId } })).toBe(PAYLOADS.length);
    expect(await prisma.branch.count({ where: { companyId } })).toBe(PAYLOADS.length);
    expect(await prisma.campaign.count({ where: { companyId } })).toBe(2);
    expect(await prisma.company.count()).toBeGreaterThanOrEqual(1); // a injeção de DELETE não esvaziou a tabela
    expect(await prisma.company.findUnique({ where: { id: companyId } })).not.toBeNull();
  });
});
