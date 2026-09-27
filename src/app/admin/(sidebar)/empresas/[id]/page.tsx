import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gauge, Users2, Wallet, MessageSquareWarning, Radio, LifeBuoy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanyOperationsSnapshot } from "@/services/company.service";
import { computeHealthScore } from "@/domain/company/health-score";
import { listFeedback } from "@/services/feedback.service";
import { listRecentEvents } from "@/services/live.service";
import { listSupportRequestsForCompany } from "@/services/support.service";
import { STATUS_LABEL, STATUS_TONE } from "@/domain/store-order/checklist";
import { formatCentsToBRL, getStoreProduct } from "@/lib/store-products";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FeedbackList } from "@/components/dashboard/feedback-list";
import { SupportRequestStatusSelect } from "@/components/admin/support-request-status-select";
import { SmartBadge, AnalyticsCard, KpiCard, AvatarStack, HeatmapCard, PremiumCardShell, LiveEventFeed, EmptyState, type LiveFeedEntry } from "@nfc-os/ui";
import { CompanyDetailTabs } from "./company-detail-tabs";
import type { FeedbackWithContext } from "@/types";

const TIMELINE_WINDOW_DAYS = 30;

function formatDateTime(value: Date | number): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

/**
 * Ferramenta de suporte real (Auditoria Nível Bilionário, 11/09/2026),
 * transformada em CRM na Fase 19.4 (Health Score/receita/heatmap) e em
 * Central do Cliente na Fase 19.7: uma segunda aba agrega pedidos,
 * feedback privado e a timeline de eventos da empresa — o que hoje só dá
 * para ver espalhado em `/admin/pedidos` (todas as empresas juntas) ou no
 * `/dashboard` da própria empresa (sem acesso do Admin). Nenhum model de
 * Ticket novo: tudo aqui já é uma tabela real do produto. "Ver como esta
 * empresa" continua deliberadamente fora — feature de autenticação
 * própria, não uma tela de leitura.
 */
export default async function AdminCompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, status: true } },
      cards: {
        select: { id: true, name: true, uniqueCode: true, active: true, createdAt: true, _count: { select: { visits: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      campaigns: { select: { id: true, name: true, type: true, status: true }, orderBy: { createdAt: "desc" }, take: 50 },
      _count: { select: { cards: true, campaigns: true } },
    },
  });
  if (!company) notFound();

  const thirtyDaysAgo = new Date(Date.now() - TIMELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [snapshot, orders, feedback, recentEvents, supportRequests] = await Promise.all([
    getCompanyOperationsSnapshot(company.id, { plan: company.plan, createdAt: company.createdAt }),
    prisma.storeOrder.findMany({ where: { companyId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    listFeedback(id, undefined, { take: 50 }) as Promise<FeedbackWithContext[]>,
    listRecentEvents(id, thirtyDaysAgo, 50),
    listSupportRequestsForCompany(id),
  ]);
  const health = computeHealthScore(snapshot.healthScoreInput);
  const totalRevenueCents = snapshot.revenue.physicalRevenueCents + snapshot.revenue.subscriptionRevenueEstimateCents;
  const timelineEntries: LiveFeedEntry[] = recentEvents.map((e) => ({ id: e.id, kind: e.kind, message: e.message, timestamp: formatDateTime(e.createdAt) }));

  const healthTone = health.score >= 70 ? "text-emerald-600 dark:text-emerald-400" : health.score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/admin/empresas">
            <ArrowLeft className="size-3.5" /> Empresas
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
          <SmartBadge label={company.accountType === "GUEST" ? "Convidada" : "Assinante"} tone={company.accountType === "GUEST" ? "warning" : "neutral"} />
          <SmartBadge label={company.plan} tone={company.plan === "STARTER" ? "neutral" : "success"} />
        </div>
        <p className="text-sm text-muted-foreground">
          /{company.slug} · {company.whatsapp || "sem WhatsApp"} · assinatura: {company.stripeSubscriptionStatus ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label="Health Score" value={health.score} icon={<Gauge />} valueClassName={healthTone} hint="0–100, ver fatores abaixo" />
        <KpiCard
          label="Receita estimada"
          value={formatCentsToBRL(totalRevenueCents)}
          icon={<Wallet />}
          hint={`${formatCentsToBRL(snapshot.revenue.subscriptionRevenueEstimateCents)} assinatura (${snapshot.revenue.monthsSinceCreated}m) + ${formatCentsToBRL(snapshot.revenue.physicalRevenueCents)} loja — estimativa, não histórico exato`}
        />
        <KpiCard label="Usuários" value={company.users.length} icon={<Users2 />} hint={`${company._count.cards} cartões · ${company._count.campaigns} campanhas`} />
      </div>

      <CompanyDetailTabs
        overview={
          <>
            <AnalyticsCard title="Por que esse Health Score" description="Cada fator é real — nenhum número escondido atrás do total.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {health.factors.map((factor) => (
                  <PremiumCardShell key={factor.key} className="p-3">
                    <p className="text-xs font-medium text-muted-foreground">{factor.label}</p>
                    <p className="mt-1 text-lg font-semibold">{factor.points}<span className="text-xs font-normal text-muted-foreground">/{factor.maxPoints}</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">{factor.detail}</p>
                  </PremiumCardShell>
                ))}
              </div>
            </AnalyticsCard>

            {snapshot.activityHeatmap.length > 0 ? (
              <HeatmapCard title="Atividade por zona (últimos 7 dias)" description="Toques e avaliações, por zona e por dia." rows={snapshot.activityHeatmap} />
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <AnalyticsCard title={`Usuários (${company.users.length})`}>
                {company.users.length > 0 ? (
                  <div className="mb-3">
                    <AvatarStack people={company.users.map((u) => ({ id: u.id, name: u.name ?? u.email }))} />
                  </div>
                ) : null}
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papel</TableHead><TableHead>Status</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.users.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Nenhum usuário — provavelmente uma empresa convidada.</TableCell></TableRow>
                    ) : (
                      company.users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="text-sm">{u.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                          <TableCell className="text-sm">{u.role}</TableCell>
                          <TableCell className="text-sm">{u.status}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </AnalyticsCard>

              <AnalyticsCard title={`Campanhas (${company._count.campaigns})`}>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.campaigns.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Nenhuma campanha ainda.</TableCell></TableRow>
                    ) : (
                      company.campaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">{c.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.type}</TableCell>
                          <TableCell className="text-sm">{c.status}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </AnalyticsCard>
            </div>

            <AnalyticsCard title={`Cartões (${company._count.cards}${company._count.cards > 100 ? ", mostrando 100 mais recentes" : ""})`}>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Nome</TableHead><TableHead>Código</TableHead><TableHead>Ativo</TableHead><TableHead>Visitas</TableHead><TableHead>Criado em</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {company.cards.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nenhum cartão ainda.</TableCell></TableRow>
                  ) : (
                    company.cards.map((card) => (
                      <TableRow key={card.id}>
                        <TableCell className="text-sm">{card.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{card.uniqueCode}</TableCell>
                        <TableCell><SmartBadge label={card.active ? "Ativo" : "Pausado"} tone={card.active ? "success" : "neutral"} /></TableCell>
                        <TableCell className="text-sm">{card._count.visits}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(card.createdAt))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </AnalyticsCard>
          </>
        }
        central={
          <>
            <AnalyticsCard title={`Pedidos da loja (${orders.length})`} description="Cartões físicos comprados por esta empresa — ações continuam em Pedidos da loja.">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nenhum pedido da loja ainda.</TableCell></TableRow>
                  ) : (
                    orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-sm">{o.customerName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{o.quantity}× {getStoreProduct(o.productId)?.name ?? o.productId}</TableCell>
                        <TableCell className="text-sm">{formatCentsToBRL(o.amountTotalCents - (o.refundAmountCents ?? 0))}</TableCell>
                        <TableCell><SmartBadge label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {orders.length > 0 ? (
                <div className="mt-3 text-right">
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <Link href="/admin/pedidos">Ver na Central de Pedidos →</Link>
                  </Button>
                </div>
              ) : null}
            </AnalyticsCard>

            <AnalyticsCard title={`Chamados de suporte (${supportRequests.length})`} description="Abertos pela própria empresa em Suporte, no Dashboard dela.">
              {supportRequests.length === 0 ? (
                <EmptyState icon={<LifeBuoy />} title="Nenhum chamado aberto por esta empresa" />
              ) : (
                <ul className="space-y-3">
                  {supportRequests.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{r.subject}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{r.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.user?.name ?? r.user?.email ?? "Usuário removido"} · {formatDateTime(r.createdAt)}
                          </p>
                        </div>
                        <SupportRequestStatusSelect id={r.id} status={r.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AnalyticsCard>

            <AnalyticsCard title={`Feedback privado (${feedback.length})`} description="Mensagens enviadas pelos clientes desta empresa em “Falar com a gente” — mesmo toggle de resolvido do painel.">
              {feedback.length === 0 ? (
                <EmptyState icon={<MessageSquareWarning />} title="Nenhum feedback privado por enquanto" />
              ) : (
                <FeedbackList initialFeedback={feedback} canManage apiBasePath="/api/admin/feedback" showExport={false} />
              )}
            </AnalyticsCard>

            <AnalyticsCard title="Timeline de eventos" description={`Últimos ${TIMELINE_WINDOW_DAYS} dias — toques, avaliações, feedbacks e trocas de campanha desta empresa.`}>
              {timelineEntries.length > 0 ? <LiveEventFeed entries={timelineEntries} /> : <EmptyState icon={<Radio />} title="Nenhum evento nos últimos 30 dias." />}
            </AnalyticsCard>
          </>
        }
      />
    </div>
  );
}
