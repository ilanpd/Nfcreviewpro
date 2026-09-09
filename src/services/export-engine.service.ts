import "server-only";
import { createElement } from "react";
import ExcelJS from "exceljs";
import { renderToBuffer } from "@react-pdf/renderer";
import { toCsv } from "@/lib/csv";
import { getExecutiveKpis, getFunnel, getPeriodComparatives, getRoiSummary, type PeriodComparatives } from "@/services/analytics-engine.service";
import { getRanking } from "@/services/ranking-engine.service";
import { getInsights } from "@/services/insights-engine.service";
import { AnalyticsReportPdf } from "@/services/export/analytics-report-pdf";
import type { FunnelStage, InsightCard, KpiValue, RankingEntry, RankingType, RoiSummary } from "@/domain/analytics/types";

/**
 * Export Engine (Fase 7) — monta um único "Relatório Executivo" a partir
 * dos outros 4 motores e o renderiza em 3 formatos (CSV/XLSX/PDF). Nenhuma
 * lógica de agregação própria — só leitura do que os outros motores já
 * calculam e formatação de saída. Ver ADR-030.
 */

const RANKING_TYPES: { type: RankingType; label: string }[] = [
  { type: "CAMPAIGN", label: "Campanhas mais utilizadas" },
  { type: "ZONE", label: "Zonas com mais conversões" },
  { type: "CARD", label: "Mesas com mais conversões" },
  { type: "EMPLOYEE", label: "Funcionários com mais conversões" },
  { type: "HOUR", label: "Horários com mais conversões" },
  { type: "DAY_OF_WEEK", label: "Dias da semana com mais conversões" },
];

export interface AnalyticsReportData {
  companyName: string;
  periodDays: number;
  generatedAt: Date;
  kpis: KpiValue[];
  funnel: FunnelStage[];
  rankings: { type: RankingType; label: string; entries: RankingEntry[] }[];
  comparatives: PeriodComparatives;
  insights: InsightCard[];
  roi: RoiSummary;
}

export async function buildAnalyticsReport(companyId: string, companyName: string, days = 30): Promise<AnalyticsReportData> {
  const [kpis, funnel, comparatives, insights, roi, rankingResults] = await Promise.all([
    getExecutiveKpis(companyId, days),
    getFunnel(companyId, days),
    getPeriodComparatives(companyId),
    getInsights(companyId, days),
    getRoiSummary(companyId, days),
    Promise.all(RANKING_TYPES.map((r) => getRanking(companyId, r.type, days, 10))),
  ]);

  return {
    companyName,
    periodDays: days,
    generatedAt: new Date(),
    kpis,
    funnel,
    rankings: RANKING_TYPES.map((r, i) => ({ ...r, entries: rankingResults[i] })),
    comparatives,
    insights,
    roi,
  };
}

function formatKpiValue(kpi: KpiValue): string {
  if (kpi.unit === "percent") return `${kpi.value.toFixed(1)}%`;
  if (kpi.unit === "currency") return `R$ ${kpi.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return kpi.value.toLocaleString("pt-BR");
}

/** CSV "achatado" (Seção/Métrica/Valor) — o único jeito honesto de exportar
 * um relatório com várias seções de formatos diferentes num único arquivo
 * de uma tabela só, sem forçar KPIs/funil/rankings na mesma grade de
 * colunas. */
export function renderReportCsv(report: AnalyticsReportData): string {
  const rows: { section: string; metric: string; value: string }[] = [];

  for (const kpi of report.kpis) rows.push({ section: "KPI", metric: kpi.label, value: formatKpiValue(kpi) });
  for (const stage of report.funnel) rows.push({ section: "Funil", metric: stage.label, value: String(stage.count) });
  for (const ranking of report.rankings) {
    ranking.entries.forEach((entry, i) => {
      rows.push({ section: ranking.label, metric: `#${i + 1} ${entry.label}`, value: `${entry.value} ${entry.secondaryLabel ?? ""}`.trim() });
    });
  }
  rows.push({ section: "Comparativo", metric: "Hoje vs. ontem", value: `${report.comparatives.dayOverDay.current} vs. ${report.comparatives.dayOverDay.previous}` });
  rows.push({ section: "Comparativo", metric: "Semana vs. semana anterior", value: `${report.comparatives.weekOverWeek.current} vs. ${report.comparatives.weekOverWeek.previous}` });
  rows.push({ section: "Comparativo", metric: "Mês vs. mês anterior", value: `${report.comparatives.monthOverMonth.current} vs. ${report.comparatives.monthOverMonth.previous}` });
  for (const insight of report.insights) rows.push({ section: "Insight", metric: insight.message, value: "" });
  rows.push({
    section: "ROI",
    metric: "Receita estimada influenciada",
    value: report.roi.configured ? `R$ ${report.roi.estimatedRevenue!.toFixed(2)}` : "ROI Mode não configurado",
  });

  return toCsv(rows, [
    { key: "section", header: "Seção" },
    { key: "metric", header: "Métrica" },
    { key: "value", header: "Valor" },
  ]);
}

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
}

/** Workbook com uma aba por seção — a versão "profissional" do mesmo
 * relatório do CSV, com formatação (cabeçalhos coloridos, larguras de
 * coluna) em vez de uma única tabela achatada. */
export async function renderReportXlsx(report: AnalyticsReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NFC Review Pro";
  workbook.created = report.generatedAt;

  const summarySheet = workbook.addWorksheet("Resumo");
  summarySheet.columns = [{ header: "KPI", key: "label", width: 32 }, { header: "Valor", key: "value", width: 20 }, { header: "Variação", key: "delta", width: 14 }];
  styleHeaderRow(summarySheet.getRow(1));
  for (const kpi of report.kpis) {
    summarySheet.addRow({ label: kpi.label, value: formatKpiValue(kpi), delta: kpi.delta !== undefined && kpi.delta !== null ? `${kpi.delta.toFixed(1)}%` : "" });
  }

  const funnelSheet = workbook.addWorksheet("Funil");
  funnelSheet.columns = [{ header: "Etapa", key: "label", width: 34 }, { header: "Quantidade", key: "count", width: 16 }, { header: "% da etapa anterior", key: "dropoff", width: 20 }];
  styleHeaderRow(funnelSheet.getRow(1));
  for (const stage of report.funnel) {
    funnelSheet.addRow({ label: stage.label, count: stage.count, dropoff: stage.dropoffFromPrevious !== null ? `${stage.dropoffFromPrevious.toFixed(1)}%` : "—" });
  }

  const rankingSheet = workbook.addWorksheet("Rankings");
  rankingSheet.columns = [{ header: "Categoria", key: "category", width: 28 }, { header: "Posição", key: "rank", width: 10 }, { header: "Nome", key: "label", width: 28 }, { header: "Valor", key: "value", width: 16 }];
  styleHeaderRow(rankingSheet.getRow(1));
  for (const ranking of report.rankings) {
    ranking.entries.forEach((entry, i) => {
      rankingSheet.addRow({ category: ranking.label, rank: i + 1, label: entry.label, value: `${entry.value} ${entry.secondaryLabel ?? ""}`.trim() });
    });
  }

  const comparativesSheet = workbook.addWorksheet("Comparativos");
  comparativesSheet.columns = [{ header: "Período", key: "label", width: 28 }, { header: "Atual", key: "current", width: 14 }, { header: "Anterior", key: "previous", width: 14 }, { header: "Variação", key: "delta", width: 14 }];
  styleHeaderRow(comparativesSheet.getRow(1));
  for (const comparison of [report.comparatives.dayOverDay, report.comparatives.weekOverWeek, report.comparatives.monthOverMonth]) {
    comparativesSheet.addRow({
      label: `${comparison.currentLabel} vs. ${comparison.previousLabel}`,
      current: comparison.current,
      previous: comparison.previous,
      delta: comparison.deltaPercent !== null ? `${comparison.deltaPercent.toFixed(1)}%` : "—",
    });
  }

  const insightsSheet = workbook.addWorksheet("Insights");
  insightsSheet.columns = [{ header: "Insight", key: "message", width: 70 }];
  styleHeaderRow(insightsSheet.getRow(1));
  for (const insight of report.insights) insightsSheet.addRow({ message: insight.message });
  if (report.insights.length === 0) insightsSheet.addRow({ message: "Nenhum insight com significância estatística suficiente neste período." });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** PDF executivo — ver `services/export/analytics-report-pdf.tsx` para o
 * layout. `createElement` em vez de JSX porque este é um módulo `.ts`, não
 * `.tsx` — a mesma convenção de arquivo dos outros serviços do produto. O
 * cast reflete só uma limitação de tipos do `@react-pdf/renderer`
 * (`renderToBuffer` está tipado para exigir um elemento `<Document>`
 * literal, não um componente que retorna um) — em tempo de execução ele só
 * precisa de uma árvore React válida cuja raiz seja um `Document`, que é
 * exatamente o que `AnalyticsReportPdf` produz. */
export async function renderReportPdf(report: AnalyticsReportData): Promise<Buffer> {
  const element = createElement(AnalyticsReportPdf, { report }) as unknown as Parameters<typeof renderToBuffer>[0];
  return renderToBuffer(element);
}
