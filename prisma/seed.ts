import { createHash } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type Prisma,
  type PlaybookCategory,
  type PlaybookTriggerType,
  type PlaybookActionType,
} from "../src/generated/prisma/client";
import { generateCardCode } from "../src/lib/codes";
import { cardPublicUrl, generateQrCodeDataUrl } from "../src/lib/qrcode";
import { DEMO_API_KEY } from "../src/domain/api-v1/demo-key";

// Hash de chave de API duplicado deliberadamente aqui, em vez de importado
// de lib/api-v1/auth.ts: aquele arquivo carrega "server-only", que lança
// fora do grafo de build do Next (ver o mesmo cuidado já tomado acima com
// codes.ts/qrcode.ts, nenhum dos dois "server-only" por esse motivo exato).
// A lógica em si é 3 linhas — duplicar isso é mais simples e honesto do que
// reestruturar lib/api-v1/auth.ts só para acomodar um script standalone.
function hashApiKey(fullKey: string): string {
  return createHash("sha256").update(fullKey).digest("hex");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: "bella-vista" },
    update: {},
    create: {
      name: "Bella Vista",
      slug: "bella-vista",
      whatsapp: "5511999999999",
      googleReviewUrl: "https://g.page/r/bella-vista/review",
      primaryColor: "#0F172A",
      plan: "PRO",
      timezone: "America/Sao_Paulo",
    },
  });

  await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "owner@demo.com" } },
    update: {},
    create: {
      companyId: company.id,
      email: "owner@demo.com",
      name: "Dono da Bella Vista",
      role: "OWNER",
      status: "PENDING", // becomes ACTIVE once they sign in with Clerk using this email
    },
  });

  // --- Zones: VIP / Varanda / Interno — a single-location business, so no
  // Branch is needed (see the NFCCard schema comment on why zones don't
  // require a branch to exist).
  const zoneNames = ["VIP", "Varanda", "Interno"];
  const zonesByName = new Map<string, { id: string }>();
  for (const name of zoneNames) {
    let zone = await prisma.zone.findFirst({ where: { companyId: company.id, name } });
    if (!zone) zone = await prisma.zone.create({ data: { companyId: company.id, name } });
    zonesByName.set(name, zone);
  }

  const cardsData: { name: string; tags: string[]; zone?: string }[] = [
    { name: "Mesa 5", tags: ["salão"], zone: "Interno" },
    { name: "Mesa VIP 1", tags: ["vip"], zone: "VIP" },
    { name: "Mesa Varanda 1", tags: ["varanda"], zone: "Varanda" },
    { name: "Recepção", tags: ["recepção"] },
    { name: "Garçom Carlos", tags: ["equipe"] },
    // Segundo cartão de equipe (Fase 7) — sem um segundo funcionário, o
    // ranking "Melhor funcionário" sempre teria exatamente 1 candidato, o
    // que não é um ranking de verdade. João é deliberadamente favorecido na
    // geração de atividade sintética abaixo, para a demo contar a história
    // "funcionário João lidera conversões" com números reais, não inventados.
    { name: "Garçom João", tags: ["equipe"] },
  ];

  const cardsByName = new Map<string, { id: string; uniqueCode: string }>();
  for (const data of cardsData) {
    let card = await prisma.nFCCard.findFirst({ where: { companyId: company.id, name: data.name } });
    if (!card) {
      const uniqueCode = generateCardCode();
      const qrCodeUrl = await generateQrCodeDataUrl(cardPublicUrl(uniqueCode));
      card = await prisma.nFCCard.create({
        data: {
          companyId: company.id,
          uniqueCode,
          qrCodeUrl,
          name: data.name,
          tags: data.tags,
          zoneId: data.zone ? zonesByName.get(data.zone)!.id : null,
        },
      });
    }
    cardsByName.set(data.name, card);
  }

  // --- Table Map (Phase 5) demo layout: positions the 5 cards above plus
  // ~45 more, spread across the 3 zones, so the map opens already populated
  // instead of empty. Grid-packed per zone block so "Todas" shows three
  // visually distinct rooms side by side, matching a real floor plan.
  function gridPosition(index: number, cols: number, originX: number, originY: number, cell = 110) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return { x: originX + col * cell, y: originY + row * cell };
  }

  const ZONE_LAYOUT: Record<string, { originX: number; originY: number; cols: number }> = {
    VIP: { originX: 40, originY: 40, cols: 4 },
    Varanda: { originX: 640, originY: 40, cols: 4 },
    Interno: { originX: 40, originY: 520, cols: 6 },
  };

  // Give the 5 original cards a position too, so nothing sits in the
  // "unplaced" tray by default — Recepção/Garçom Carlos get a small lobby
  // row of their own, above the three zone blocks.
  const lobbyPositions: Record<string, { x: number; y: number }> = {
    Recepção: { x: 640, y: -80 },
    "Garçom Carlos": { x: 800, y: -80 },
    "Garçom João": { x: 960, y: -80 },
  };
  const zoneSlotUsed: Record<string, number> = { VIP: 0, Varanda: 0, Interno: 0 };
  for (const data of cardsData) {
    const existing = cardsByName.get(data.name)!;
    const current = await prisma.nFCCard.findUnique({ where: { id: existing.id }, select: { layoutX: true } });
    if (current?.layoutX !== null) continue; // already positioned from a previous seed run

    if (data.zone) {
      const layout = ZONE_LAYOUT[data.zone];
      const pos = gridPosition(zoneSlotUsed[data.zone]++, layout.cols, layout.originX, layout.originY);
      await prisma.nFCCard.update({ where: { id: existing.id }, data: { layoutX: pos.x, layoutY: pos.y, tableShape: "RECTANGLE", seats: 4 } });
    } else {
      const pos = lobbyPositions[data.name] ?? { x: 640, y: -80 };
      await prisma.nFCCard.update({ where: { id: existing.id }, data: { layoutX: pos.x, layoutY: pos.y, tableShape: "CIRCLE", seats: 2 } });
    }
  }

  // ~45 additional tables (15 VIP, 15 Varanda, 15 Interno) to reach ~50
  // positioned tables total across the 3 zones, per the Phase 5 demo brief.
  const EXTRA_PER_ZONE = 15;
  for (const zoneName of zoneNames) {
    const layout = ZONE_LAYOUT[zoneName];
    for (let i = 0; i < EXTRA_PER_ZONE; i++) {
      const tableNumber = zoneSlotUsed[zoneName] + 1;
      const name = `${zoneName} ${tableNumber}`;
      const existingExtra = await prisma.nFCCard.findFirst({ where: { companyId: company.id, name } });
      if (existingExtra) {
        zoneSlotUsed[zoneName]++;
        continue;
      }
      const pos = gridPosition(zoneSlotUsed[zoneName]++, layout.cols, layout.originX, layout.originY);
      const uniqueCode = generateCardCode();
      const qrCodeUrl = await generateQrCodeDataUrl(cardPublicUrl(uniqueCode));
      await prisma.nFCCard.create({
        data: {
          companyId: company.id,
          uniqueCode,
          qrCodeUrl,
          name,
          tags: [zoneName.toLowerCase()],
          zoneId: zonesByName.get(zoneName)!.id,
          layoutX: pos.x,
          layoutY: pos.y,
          tableShape: tableNumber % 3 === 0 ? "CIRCLE" : "RECTANGLE",
          seats: tableNumber % 3 === 0 ? 6 : 4,
        },
      });
    }
  }

  // --- Campaigns: demonstrates all 4 scopes/statuses the Campaign Manager
  // supports. See RELATORIO_FASE_2.md for the full narrative.
  type CampaignSeed = {
    name: string;
    description: string;
    type: Prisma.CampaignCreateInput["type"];
    status: Prisma.CampaignCreateInput["status"];
    priority: number;
    startsAt?: Date;
    endsAt?: Date;
    recurrenceType?: Prisma.CampaignCreateInput["recurrenceType"];
    recurrenceConfig?: object;
    config: object;
    assign?: { scope: "COMPANY" } | { scope: "ZONE"; zoneName: string } | { scope: "CARD"; cardName: string };
    rules?: { type: Prisma.RuleCreateInput["type"]; config: object }[];
    variants?: { name: string; weight: number; config: object }[];
  };

  const campaignSeeds: CampaignSeed[] = [
    {
      name: "Black Friday 2026",
      description: "Landing page promocional da Black Friday — vale para todo o restaurante.",
      type: "LANDING_PAGE",
      status: "ACTIVE",
      priority: 10,
      startsAt: new Date("2026-11-27T00:00:00-03:00"),
      endsAt: new Date("2026-11-30T23:59:59-03:00"),
      config: { url: "https://bellavista.example.com/black-friday" },
      assign: { scope: "COMPANY" },
      // A/B test: two landing page variants splitting traffic 70/30 — see
      // RELATORIO_FASE_3.md for how to confirm this in the browser.
      variants: [
        { name: "Controle", weight: 70, config: { url: "https://bellavista.example.com/black-friday" } },
        { name: "Variante — vídeo", weight: 30, config: { url: "https://bellavista.example.com/black-friday-video" } },
      ],
    },
    {
      name: "Happy Hour Sexta",
      description: "Convite via WhatsApp para o Happy Hour — só para as mesas da zona VIP, só sexta 18h-22h.",
      type: "WHATSAPP",
      status: "ACTIVE",
      priority: 5,
      // WEEKLY recurrence — Phase 3 now actually enforces this via
      // domain/rules/recurrence.ts, translated into the same rule engine
      // every hand-created Rule goes through. Outside Friday 18-22h
      // (America/Sao_Paulo), this campaign is simply not eligible.
      recurrenceType: "WEEKLY",
      recurrenceConfig: { daysOfWeek: [5], startTime: "18:00", endTime: "22:00" },
      config: { phone: "5511999999999", message: "Bem-vindo ao Happy Hour da Bella Vista! 🍹" },
      assign: { scope: "ZONE", zoneName: "VIP" },
    },
    {
      name: "Google Reviews VIP",
      description:
        "Substitui o fluxo padrão só na Mesa VIP 1, e só em celular/tablet — sempre vence a campanha de zona por especificidade quando a regra de dispositivo permite.",
      type: "GOOGLE_REVIEWS",
      status: "ACTIVE",
      priority: 0,
      config: { url: company.googleReviewUrl },
      assign: { scope: "CARD", cardName: "Mesa VIP 1" },
      rules: [{ type: "DEVICE_TYPE", config: { devices: ["mobile", "tablet"] } }],
    },
    {
      name: "Instagram Geral",
      description: "Rascunho — ainda não publicada, não afeta nenhum cartão.",
      type: "INSTAGRAM",
      status: "DRAFT",
      priority: 0,
      config: { url: "https://instagram.com/bellavista" },
    },
    // Two zone-scoped campaigns of different types, specifically for the
    // Table Map (Phase 5) demo — each zone shows a visibly different status
    // color (see domain/campaign/destination.ts's DESTINATION_META.color),
    // exactly the "campanhas diferentes por área" requirement.
    {
      name: "Varanda no Instagram",
      description: "Convida os clientes da varanda a seguir o Instagram — toda a zona Varanda.",
      type: "INSTAGRAM",
      status: "ACTIVE",
      priority: 3,
      config: { url: "https://instagram.com/bellavista" },
      assign: { scope: "ZONE", zoneName: "Varanda" },
    },
    {
      name: "Cardápio do Salão Interno",
      description: "Cardápio digital para as mesas do salão interno — toda a zona Interno.",
      type: "DIGITAL_MENU",
      status: "ACTIVE",
      priority: 3,
      config: { url: "https://bellavista.example.com/cardapio" },
      assign: { scope: "ZONE", zoneName: "Interno" },
    },
  ];

  for (const seed of campaignSeeds) {
    let campaign = await prisma.campaign.findFirst({ where: { companyId: company.id, name: seed.name } });
    const isNewCampaign = !campaign;
    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: {
          companyId: company.id,
          name: seed.name,
          description: seed.description,
          type: seed.type,
          status: seed.status,
          priority: seed.priority,
          startsAt: seed.startsAt,
          endsAt: seed.endsAt,
          recurrenceType: seed.recurrenceType ?? "NONE",
          recurrenceConfig: seed.recurrenceConfig,
          config: seed.config,
        },
      });
    }

    if (isNewCampaign) {
      for (const rule of seed.rules ?? []) {
        await prisma.rule.create({
          data: { companyId: company.id, campaignId: campaign.id, type: rule.type, config: rule.config },
        });
      }
      for (const variant of seed.variants ?? []) {
        await prisma.campaignVariant.create({
          data: { companyId: company.id, campaignId: campaign.id, name: variant.name, weight: variant.weight, config: variant.config },
        });
      }
    }

    if (!seed.assign) continue;
    const existingAssignment = await prisma.campaignAssignment.findFirst({ where: { campaignId: campaign.id } });
    if (existingAssignment) continue;

    if (seed.assign.scope === "COMPANY") {
      await prisma.campaignAssignment.create({
        data: { companyId: company.id, campaignId: campaign.id, scope: "COMPANY" },
      });
    } else if (seed.assign.scope === "ZONE") {
      await prisma.campaignAssignment.create({
        data: {
          companyId: company.id,
          campaignId: campaign.id,
          scope: "ZONE",
          zoneId: zonesByName.get(seed.assign.zoneName)!.id,
        },
      });
    } else {
      await prisma.campaignAssignment.create({
        data: {
          companyId: company.id,
          campaignId: campaign.id,
          scope: "CARD",
          cardId: cardsByName.get(seed.assign.cardName)!.id,
        },
      });
    }
  }

  // --- Phase 4: Organization + a second franchise unit, demonstrating
  // multi-unit RBAC v2 (Branch, restricted access, ORGANIZATION-scope
  // campaigns reaching across companies). See DECISOES_DE_ARQUITETURA.md
  // ADR-013.
  let organization = await prisma.organization.findUnique({ where: { slug: "rede-bella-vista" } });
  if (!organization) {
    organization = await prisma.organization.create({ data: { name: "Rede Bella Vista", slug: "rede-bella-vista" } });
  }
  if (!company.organizationId) {
    await prisma.company.update({ where: { id: company.id }, data: { organizationId: organization.id } });
  }

  const shoppingUnit = await prisma.company.upsert({
    where: { slug: "bella-vista-shopping" },
    update: { organizationId: organization.id },
    create: {
      name: "Bella Vista Shopping",
      slug: "bella-vista-shopping",
      organizationId: organization.id,
      whatsapp: "5511988888888",
      googleReviewUrl: "https://g.page/r/bella-vista-shopping/review",
      primaryColor: "#0F172A",
      plan: "PRO",
      timezone: "America/Sao_Paulo",
    },
  });

  await prisma.user.upsert({
    where: { companyId_email: { companyId: shoppingUnit.id, email: "gerente-shopping@demo.com" } },
    update: {},
    create: {
      companyId: shoppingUnit.id,
      email: "gerente-shopping@demo.com",
      name: "Gerente da Unidade Shopping",
      role: "ADMIN",
      status: "PENDING",
    },
  });

  let shoppingBranch = await prisma.branch.findFirst({ where: { companyId: shoppingUnit.id, name: "Shopping Morumbi" } });
  if (!shoppingBranch) {
    shoppingBranch = await prisma.branch.create({ data: { companyId: shoppingUnit.id, name: "Shopping Morumbi" } });
  }
  let foodCourtZone = await prisma.zone.findFirst({ where: { companyId: shoppingUnit.id, name: "Praça de Alimentação" } });
  if (!foodCourtZone) {
    foodCourtZone = await prisma.zone.create({
      data: { companyId: shoppingUnit.id, name: "Praça de Alimentação", branchId: shoppingBranch.id },
    });
  }
  let shoppingCard = await prisma.nFCCard.findFirst({ where: { companyId: shoppingUnit.id, name: "Mesa 1" } });
  if (!shoppingCard) {
    const uniqueCode = generateCardCode();
    const qrCodeUrl = await generateQrCodeDataUrl(cardPublicUrl(uniqueCode));
    shoppingCard = await prisma.nFCCard.create({
      data: {
        companyId: shoppingUnit.id,
        uniqueCode,
        qrCodeUrl,
        name: "Mesa 1",
        tags: ["salão"],
        branchId: shoppingBranch.id,
        zoneId: foodCourtZone.id,
      },
    });
  }

  // A campaign assigned at ORGANIZATION scope reaches every card in every
  // company under "Rede Bella Vista" — including the Shopping unit created
  // above — without being assigned per-company. See resolution-engine/data.ts's
  // loadOrganizationCampaigns().
  let loyaltyCampaign = await prisma.campaign.findFirst({ where: { companyId: company.id, name: "Programa de Fidelidade" } });
  if (!loyaltyCampaign) {
    loyaltyCampaign = await prisma.campaign.create({
      data: {
        companyId: company.id,
        name: "Programa de Fidelidade",
        description: "Convite para o programa de fidelidade — vale para todas as unidades da rede.",
        type: "WHATSAPP",
        status: "ACTIVE",
        priority: 1,
        config: { phone: "5511999999999", message: "Conheça o programa de fidelidade da Rede Bella Vista! 🎁" },
      },
    });
    await prisma.campaignAssignment.create({
      data: {
        companyId: company.id,
        campaignId: loyaltyCampaign.id,
        scope: "ORGANIZATION",
        organizationId: organization.id,
      },
    });
  }

  // A Manager restricted to the VIP zone only — demonstrates UserAccessScope
  // as an opt-in restriction (ADR-015): every other user in this seed has
  // zero scope rows and is unrestricted within their role's permissions.
  const vipZone = zonesByName.get("VIP")!;
  const scopedManager = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "gerente-vip@demo.com" } },
    update: {},
    create: {
      companyId: company.id,
      email: "gerente-vip@demo.com",
      name: "Gerente da Zona VIP",
      role: "MANAGER",
      status: "PENDING",
    },
  });
  const existingScope = await prisma.userAccessScope.findFirst({
    where: { userId: scopedManager.id, zoneId: vipZone.id },
  });
  if (!existingScope) {
    await prisma.userAccessScope.create({
      data: { companyId: company.id, userId: scopedManager.id, zoneId: vipZone.id },
    });
  }

  // --- Fase 6/7: atividade sintética para o salão não abrir "morto" ---
  // Sem isso, o Heatmap, o Feed de Eventos, o Time Machine, o Command
  // Center e o Analytics Enterprise abririam vazios — nenhuma dessas 4
  // tabelas (RedirectLog/Visit/RatingEvent/PrivateFeedback) tinha uma única
  // linha até a Fase 6. A Fase 7 estende a janela de 36h para 14 dias (dá
  // massa real para os comparativos semana-vs-semana/mês-vs-mês e para o
  // Forecast) e injeta vieses deliberados e documentados — nunca inventando
  // um insight, só tornando plausível que a Bella Vista realmente teria a
  // história "Happy Hour engaja no horário certo, Varanda converte melhor,
  // Mesa VIP e o garçom João lideram avaliações" se fosse um restaurante de
  // verdade. Todo insight/ranking que a demo mostra continua sendo
  // recalculado a partir destas linhas, nunca escrito diretamente.
  const existingRedirectCount = await prisma.redirectLog.count({ where: { companyId: company.id } });
  if (existingRedirectCount === 0) {
    const allCards = await prisma.nFCCard.findMany({ where: { companyId: company.id } });
    const vipZone = zonesByName.get("VIP")!;
    const varandaZone = zonesByName.get("Varanda")!;
    const internoZone = zonesByName.get("Interno")!;
    const happyHourCampaign = await prisma.campaign.findFirst({ where: { companyId: company.id, name: "Happy Hour Sexta" } });
    const varandaCampaign = await prisma.campaign.findFirst({ where: { companyId: company.id, name: "Varanda no Instagram" } });
    const cardapioCampaign = await prisma.campaign.findFirst({ where: { companyId: company.id, name: "Cardápio do Salão Interno" } });
    const mesaVip1 = cardsByName.get("Mesa VIP 1")!;
    const garcomJoao = cardsByName.get("Garçom João")!;
    const garcomCarlos = cardsByName.get("Garçom Carlos")!;

    // Resolve o toque para uma campanha só quando ela plausivelmente
    // "venceria" de verdade no Resolution Engine — a Happy Hour só dentro da
    // própria janela configurada (sexta 18h-22h, a mesma recorrência real da
    // campanha), a Varanda só em parte dos toques (o resto cai no fluxo
    // padrão, senão a zona nunca teria uma avaliação para comparar).
    function campaignForTouch(card: { id: string; zoneId: string | null }, at: Date): string | null {
      if (card.zoneId === vipZone.id) {
        const isFridayEvening = at.getDay() === 5 && at.getHours() >= 18 && at.getHours() < 22;
        return isFridayEvening ? happyHourCampaign?.id ?? null : null;
      }
      if (card.zoneId === varandaZone.id) return Math.random() < 0.4 ? varandaCampaign?.id ?? null : null;
      if (card.zoneId === internoZone.id) return cardapioCampaign?.id ?? null;
      return null;
    }

    // Só quando o toque cai no fluxo padrão (sem campanha) ele pode virar
    // uma avaliação — probabilidade de tentar avaliar e de dar nota alta,
    // por cartão/zona. Os valores-padrão são propositalmente baixos: o
    // Forecast Engine (Fase 7) só fica interessante ("faltam N dias para
    // 100 avaliações") se o total ainda estiver bem abaixo de 100 ao final
    // do seed, não já tê-la ultrapassado.
    // Fase 11 — o gatilho ZONE_TIME_PERFORMANCE ("Happy Hour Boost") precisa
    // de um sinal real POR HORÁRIO dentro da mesma zona, não só "Varanda
    // converte melhor que as outras" (isso já existia desde a Fase 7 para o
    // Insight Engine). O viés abaixo é aditivo: fora da janela 18h-22h, a
    // Varanda mantém exatamente os mesmos números de sempre.
    function attemptRatingProbability(card: { id: string; zoneId: string | null }, at: Date): number {
      if (card.id === mesaVip1.id) return 0.8; // "Mesa VIP lidera avaliações"
      if (card.zoneId === varandaZone.id) {
        const isEvening = at.getHours() >= 18 && at.getHours() < 22;
        return isEvening ? 0.75 : 0.35; // "Varanda virou destaque" à noite
      }
      return 0.18;
    }
    function highStarProbability(card: { id: string; zoneId: string | null }, at: Date): number {
      if (card.id === mesaVip1.id) return 0.9;
      if (card.zoneId === varandaZone.id) {
        const isEvening = at.getHours() >= 18 && at.getHours() < 22;
        return isEvening ? 0.85 : 0.55;
      }
      return 0.45;
    }
    // "Funcionário" é o próprio NFCCard tagueado "equipe" (ver ADR-019/ADR-030)
    // — o viés de João vem do mesmo mecanismo usado para as mesas, não de um
    // caminho de código separado para "funcionários".
    function employeeConversionBoost(card: { id: string }): number {
      if (card.id === garcomJoao.id) return 0.85;
      if (card.id === garcomCarlos.id) return 0.35;
      return 0;
    }

    const HISTORY_DAYS = 14;
    function weightedTimestamp(): Date {
      // 70% do tempo, um viés forte para as últimas 36h (Live Mode/Heatmap/
      // Command Center parecem "vivos" assim que a demo abre); 30% do tempo,
      // espalhado pelos 14 dias inteiros — sem isso, os comparativos
      // semana-vs-semana e mês-vs-mês e o Forecast não teriam história
      // nenhuma antes de "ontem".
      if (Math.random() < 0.7) {
        const hoursAgo = Math.min(Math.random() * 36, Math.random() * 36);
        return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      }
      const hoursAgo = Math.random() * HISTORY_DAYS * 24;
      return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    }

    let feedbackSeed = 0;
    for (const card of allCards) {
      const isEmployeeCard = card.id === garcomJoao.id || card.id === garcomCarlos.id;
      const touches = isEmployeeCard ? 15 + Math.floor(Math.random() * 15) : 3 + Math.floor(Math.random() * 13);
      // Fase 11 — o gatilho VIP_TABLE_IDLE ("VIP Table Recovery") precisa de
      // pelo menos uma mesa VIP genuinamente silenciosa há dias, não só
      // "menos ativa que a média". Mesa VIP 1 é a única mesa de toda a demo
      // sem nenhum toque nos últimos 4 dias — deliberado, para o gatilho
      // disparar de verdade sem inventar um número fora do RedirectLog.
      const isIdleVip = card.id === mesaVip1.id;

      for (let i = 0; i < touches; i++) {
        const createdAt = isIdleVip ? new Date(Date.now() - (4 + Math.random() * (HISTORY_DAYS - 4)) * 86_400_000) : weightedTimestamp();
        const campaignId = isEmployeeCard ? null : campaignForTouch(card, createdAt);
        const outcome = campaignId ? "CAMPAIGN" : "REVIEW_FLOW_FALLBACK";

        await prisma.redirectLog.create({
          data: { companyId: company.id, cardId: card.id, campaignId, outcome, resolvedFromCache: Math.random() > 0.3, createdAt },
        });

        // Só o fluxo padrão (sem campanha) chega a renderizar <RatingFlow> e
        // pode gerar uma avaliação de verdade — igual à produção, uma
        // campanha redireciona direto sem passar pelo fluxo de estrelas.
        if (campaignId) continue;

        const attemptProbability = isEmployeeCard ? employeeConversionBoost(card) : attemptRatingProbability(card, createdAt);
        if (Math.random() >= attemptProbability) continue;

        const visit = await prisma.visit.create({
          data: {
            cardId: card.id,
            companyId: company.id,
            device: Math.random() > 0.3 ? "mobile" : "desktop",
            ipHash: `seed-${card.id}-${i}`,
            createdAt,
          },
        });
        const highStarChance = isEmployeeCard ? employeeConversionBoost(card) : highStarProbability(card, createdAt);
        const stars = Math.random() < highStarChance ? 4 + Math.round(Math.random()) : 1 + Math.floor(Math.random() * 3);
        const ratingEvent = await prisma.ratingEvent.create({
          data: { visitId: visit.id, companyId: company.id, cardId: card.id, stars, redirectedGoogle: stars >= 4, createdAt },
        });
        if (stars <= 3) {
          feedbackSeed++;
          await prisma.privateFeedback.create({
            data: {
              ratingEventId: ratingEvent.id,
              companyId: company.id,
              message: feedbackSeed % 2 === 0 ? "Poderia ser mais rápido no atendimento." : "A comida esfriou até chegar na mesa.",
              createdAt,
            },
          });
        }
      }
    }
    console.log(`Atividade sintética gerada para ${allCards.length} mesas/cartões (últimos ${HISTORY_DAYS} dias).`);
  }

  // --- Smart Campaign Playbooks (Fase 11): biblioteca declarativa global ---
  // Sete playbooks reais, cada um reaproveitando um dos 7 PlaybookTriggerType/
  // 4 PlaybookActionType já existentes — nunca uma linha de código nova por
  // playbook (ver ADR-048). "Happy Hour Boost" e "VIP Table Recovery" têm
  // dados sintéticos deliberadamente enviesados acima para disparar de
  // verdade nesta empresa de demonstração; os demais dependem do padrão
  // aleatório dos dados sintéticos gerados nesta execução, honestamente.
  const playbookSeeds: {
    key: string;
    name: string;
    description: string;
    category: PlaybookCategory;
    triggerType: PlaybookTriggerType;
    triggerConfig: Prisma.InputJsonValue;
    actionType: PlaybookActionType;
    actionConfig: Prisma.InputJsonValue;
    estimatedDurationHours: number;
    reversalDescription: string;
    safeForAutomation: boolean;
  }[] = [
    {
      key: "happy-hour-boost",
      name: "Happy Hour Boost",
      description: "Detecta quando uma zona converte melhor num horário específico e sugere uma campanha de Happy Hour só para essa janela.",
      category: "REVENUE",
      triggerType: "ZONE_TIME_PERFORMANCE",
      triggerConfig: { windowStartHour: 18, windowEndHour: 22, windowLabel: "18h–22h", minSampleSize: 20, minDeltaPercent: 25, maxRecencyHours: 48 },
      actionType: "CREATE_AND_ASSIGN_CAMPAIGN",
      actionConfig: {
        preferredCampaignType: "WHATSAPP",
        campaignName: "Happy Hour Boost (Playbook)",
        messageTemplate: "Happy Hour começou! Peça já sua bebida com desconto especial 🍹",
        rule: { type: "TIME_WINDOW", config: { startTime: "18:00", endTime: "22:00" } },
      },
      estimatedDurationHours: 4,
      reversalDescription: "Remove a atribuição da campanha e a arquiva, já que foi criada só para esta recomendação.",
      safeForAutomation: true,
    },
    {
      key: "google-review-recovery",
      name: "Google Review Recovery",
      description: "Percebe uma queda real na conversão para avaliação no Google e sugere reforçar o pedido de avaliação.",
      category: "REPUTATION",
      triggerType: "RATING_DROP",
      triggerConfig: { recentWindowHours: 24, minSampleSize: 10, minDropPercent: 20, maxRecencyHours: 24 },
      actionType: "CREATE_AND_ASSIGN_CAMPAIGN",
      actionConfig: { preferredCampaignType: "GOOGLE_REVIEWS", campaignName: "Recuperação de Avaliações (Playbook)" },
      estimatedDurationHours: 48,
      reversalDescription: "Remove a atribuição da campanha e a arquiva, já que foi criada só para esta recomendação.",
      safeForAutomation: false,
    },
    {
      key: "instagram-momentum",
      name: "Instagram Momentum",
      description: "Vê os toques de uma campanha de Instagram subindo de verdade e sugere aumentar a prioridade dela enquanto o momentum dura.",
      category: "ENGAGEMENT",
      triggerType: "SOCIAL_MOMENTUM",
      triggerConfig: { windowHours: 24, minSampleSize: 10, minDeltaPercent: 30, maxRecencyHours: 24 },
      actionType: "BOOST_CAMPAIGN_PRIORITY",
      actionConfig: { priorityDelta: 20 },
      estimatedDurationHours: 24,
      reversalDescription: "Restaura a prioridade que a campanha tinha antes desta execução.",
      safeForAutomation: true,
    },
    {
      key: "vip-table-recovery",
      name: "VIP Table Recovery",
      description: "Identifica uma mesa VIP silenciosa bem além do seu próprio padrão histórico e sugere reengajar o cliente.",
      category: "ENGAGEMENT",
      triggerType: "VIP_TABLE_IDLE",
      triggerConfig: { tag: "vip", idleMultiplier: 2.5, minAvgHours: 6, maxRecencyHours: 168 },
      actionType: "CREATE_AND_ASSIGN_CAMPAIGN",
      actionConfig: {
        preferredCampaignType: "WHATSAPP",
        campaignName: "Resgate VIP (Playbook)",
        messageTemplate: "Sentimos sua falta na mesa VIP! Uma sobremesa por conta da casa te espera 🍰",
      },
      estimatedDurationHours: 72,
      reversalDescription: "Remove a atribuição da campanha e a arquiva, já que foi criada só para esta recomendação.",
      safeForAutomation: false,
    },
    {
      key: "silent-zone-rescue",
      name: "Silent Zone Rescue",
      description: "Percebe uma zona inteira sem nenhum toque bem além do seu padrão e sugere uma campanha de reengajamento para ela.",
      category: "ENGAGEMENT",
      triggerType: "ZONE_SILENT",
      triggerConfig: { idleMultiplier: 3, minAvgHours: 4, maxRecencyHours: 168 },
      actionType: "CREATE_AND_ASSIGN_CAMPAIGN",
      actionConfig: {
        preferredCampaignType: "WHATSAPP",
        campaignName: "Resgate de Zona (Playbook)",
        messageTemplate: "Vem conferir as novidades de hoje! 😋",
      },
      estimatedDurationHours: 24,
      reversalDescription: "Remove a atribuição da campanha e a arquiva, já que foi criada só para esta recomendação.",
      safeForAutomation: true,
    },
    {
      key: "lunch-rush-optimization",
      name: "Lunch Rush Optimization",
      description: "Compara a participação da janela de almoço no total de toques com o esperado e sugere uma campanha para a janela de almoço.",
      category: "CAPACITY",
      triggerType: "LUNCH_WINDOW_UNDERUSED",
      triggerConfig: { windowStartHour: 11, windowEndHour: 14, windowLabel: "11h–14h", expectedSharePercent: 20, minDeltaPercent: 15, minSampleSize: 30, maxRecencyHours: 48 },
      actionType: "CREATE_AND_ASSIGN_CAMPAIGN",
      actionConfig: {
        preferredCampaignType: "WHATSAPP",
        campaignName: "Impulso do Almoço (Playbook)",
        messageTemplate: "Almoço de hoje tem prato especial! Confira 🍽️",
        rule: { type: "TIME_WINDOW", config: { startTime: "11:00", endTime: "14:00" } },
      },
      estimatedDurationHours: 6,
      reversalDescription: "Remove a atribuição da campanha e a arquiva, já que foi criada só para esta recomendação.",
      safeForAutomation: true,
    },
    {
      key: "weekend-accelerator",
      name: "Weekend Accelerator",
      description: "Vê a projeção da campanha líder subindo indo para o fim de semana e sugere reforçar a prioridade dela.",
      category: "REVENUE",
      triggerType: "WEEKEND_FORECAST_UP",
      triggerConfig: { minUpliftPercent: 15, minDailyRate: 1 },
      actionType: "BOOST_CAMPAIGN_PRIORITY",
      actionConfig: { priorityDelta: 15 },
      estimatedDurationHours: 48,
      reversalDescription: "Restaura a prioridade que a campanha tinha antes desta execução.",
      safeForAutomation: true,
    },
  ];

  for (const seed of playbookSeeds) {
    await prisma.playbook.upsert({
      where: { key: seed.key },
      update: {},
      create: {
        key: seed.key,
        name: seed.name,
        description: seed.description,
        category: seed.category,
        triggerType: seed.triggerType,
        triggerConfig: seed.triggerConfig,
        actionType: seed.actionType,
        actionConfig: seed.actionConfig,
        estimatedDurationHours: seed.estimatedDurationHours,
        reversalDescription: seed.reversalDescription,
        safeForAutomation: seed.safeForAutomation,
      },
    });
  }
  console.log(`Biblioteca de Playbooks semeada (${playbookSeeds.length} playbooks).`);

  // --- White Label Live Switch (Fase 12): mais 2 empresas fictícias reais ---
  // Nunca marcas de verdade (evitar qualquer risco de marca registrada) —
  // duas identidades visuais genuinamente diferentes, cada uma um `Company`
  // real com sua própria cor/nome, para o Demo OS trocar a marca ao vivo
  // (`BrandProvider`) sobre a MESMA operação da Bella Vista por baixo. Sem
  // cartões/zonas próprios — o objetivo aqui é só a identidade visual, os
  // dados mostrados no Demo OS continuam sendo os reais da Bella Vista.
  const whiteLabelDemoCompanies = [
    { name: "Sushi House", slug: "sushi-house-demo", primaryColor: "#B91C1C", secondaryColor: "#111827", whatsapp: "5511977777777", googleReviewUrl: "https://g.page/r/sushi-house-demo/review" },
    { name: "Nova Steakhouse", slug: "nova-steakhouse-demo", primaryColor: "#7C2D12", secondaryColor: "#D4A017", whatsapp: "5511966666666", googleReviewUrl: "https://g.page/r/nova-steakhouse-demo/review" },
  ];
  for (const wl of whiteLabelDemoCompanies) {
    await prisma.company.upsert({
      where: { slug: wl.slug },
      update: {},
      create: {
        name: wl.name,
        slug: wl.slug,
        whatsapp: wl.whatsapp,
        googleReviewUrl: wl.googleReviewUrl,
        primaryColor: wl.primaryColor,
        secondaryColor: wl.secondaryColor,
        plan: "PRO",
        timezone: "America/Sao_Paulo",
      },
    });
  }
  console.log(`Empresas do White Label Live Switch semeadas (${whiteLabelDemoCompanies.length} marcas fictícias).`);

  // API Pública v1 (Fase 9) — uma chave de demonstração somente leitura,
  // fixa, para o Playground público em /developers poder fazer chamadas
  // reais contra a Bella Vista sem exigir que um visitante crie conta.
  // Nunca escopos de escrita — o Playground é uma vitrine, não um jeito de
  // um estranho editar dados de demonstração.
  await prisma.apiKey.upsert({
    where: { keyHash: hashApiKey(DEMO_API_KEY) },
    update: {},
    create: {
      companyId: company.id,
      name: "Chave de demonstração (Playground /developers)",
      keyPrefix: DEMO_API_KEY.slice(0, 21),
      keyHash: hashApiKey(DEMO_API_KEY),
      scopes: [
        "cards:read",
        "campaigns:read",
        "zones:read",
        "branches:read",
        "organizations:read",
        "analytics:read",
        "events:read",
        "feedback:read",
      ],
    },
  });

  console.log(`Seed concluído para a empresa "${company.name}" (slug: ${company.slug}).`);
  console.log(`Organização "${organization.name}" com unidades: ${company.name}, ${shoppingUnit.name}.`);
  console.log(`Chave de API de demonstração pronta para o Playground (somente leitura).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
