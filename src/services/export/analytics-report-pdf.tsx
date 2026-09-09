import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AnalyticsReportData } from "../export-engine.service";
import type { KpiValue } from "@/domain/analytics/types";

// Aproximação em hex da cor de marca do produto (`oklch(0.549 0.214 279)`
// em globals.css) — PDF não consome variáveis CSS, então o acento visual
// deste relatório é um hex fixo próximo, não a mesma fonte da verdade do
// resto do produto. Ver ADR-030.
const ACCENT = "#4F46E5";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  header: { marginBottom: 16, borderBottomWidth: 2, borderBottomColor: ACCENT, borderBottomStyle: "solid", paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: "bold", color: ACCENT },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginTop: 16, marginBottom: 6 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap" },
  kpiCard: { width: "23%", marginRight: "2%", marginBottom: 8, borderWidth: 1, borderColor: BORDER, borderStyle: "solid", borderRadius: 4, padding: 8 },
  kpiLabel: { fontSize: 8, color: MUTED },
  kpiValue: { fontSize: 14, fontWeight: "bold", marginTop: 2 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F3F4F6", borderBottomStyle: "solid", paddingVertical: 4 },
  rowLabel: { flex: 1 },
  rowValue: { width: 90, textAlign: "right" },
  insight: { marginBottom: 4, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: ACCENT, borderLeftStyle: "solid" },
  rankingBlock: { marginBottom: 10 },
  rankingTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#9CA3AF", textAlign: "center" },
});

function formatKpiValuePdf(kpi: KpiValue): string {
  if (kpi.unit === "percent") return `${kpi.value.toFixed(1)}%`;
  if (kpi.unit === "currency") return `R$ ${kpi.value.toFixed(2)}`;
  return kpi.value.toLocaleString("pt-BR");
}

/**
 * Relatório Executivo em PDF (Fase 7) — desenhado para parecer algo que se
 * envia a um investidor ou diretor, não uma exportação de dados crua: capa
 * com KPIs em grade, funil, insights automáticos na primeira página;
 * rankings e ROI Mode na segunda. Ver `export-engine.service.ts` para a
 * montagem dos dados e ADR-030 para a escolha de `@react-pdf/renderer` em
 * vez de um headless browser (sem dependência de Chromium em produção
 * serverless — a mesma lógica de "sem infraestrutura exótica" do ADR-025).
 */
export function AnalyticsReportPdf({ report }: { report: AnalyticsReportData }) {
  return (
    <Document title={`Relatório Executivo — ${report.companyName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Relatório Executivo — {report.companyName}</Text>
          <Text style={styles.subtitle}>
            Últimos {report.periodDays} dias · gerado em {report.generatedAt.toLocaleString("pt-BR")}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Indicadores</Text>
        <View style={styles.kpiGrid}>
          {report.kpis.map((kpi) => (
            <View key={kpi.key} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiValue}>{formatKpiValuePdf(kpi)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Funil de avaliação</Text>
        {report.funnel.map((stage) => (
          <View key={stage.key} style={styles.row}>
            <Text style={styles.rowLabel}>{stage.label}</Text>
            <Text style={styles.rowValue}>{stage.count}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Insights automáticos</Text>
        {report.insights.length === 0 ? (
          <Text style={{ color: MUTED }}>Nenhum insight com significância estatística suficiente neste período.</Text>
        ) : (
          report.insights.map((insight) => (
            <View key={insight.id} style={styles.insight}>
              <Text>{insight.message}</Text>
            </View>
          ))
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages} — NFC Review Pro`} fixed />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Rankings</Text>
        {report.rankings.map((ranking) => (
          <View key={ranking.type} style={styles.rankingBlock}>
            <Text style={styles.rankingTitle}>{ranking.label}</Text>
            {ranking.entries.length === 0 ? (
              <Text style={{ color: MUTED }}>Sem dados suficientes.</Text>
            ) : (
              ranking.entries.slice(0, 5).map((entry, i) => (
                <View key={entry.id} style={styles.row}>
                  <Text style={styles.rowLabel}>
                    {i + 1}. {entry.label}
                  </Text>
                  <Text style={styles.rowValue}>
                    {entry.value} {entry.secondaryLabel ?? ""}
                  </Text>
                </View>
              ))
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>ROI Mode</Text>
        <Text>
          {report.roi.configured
            ? `Receita estimada influenciada: R$ ${report.roi.estimatedRevenue!.toFixed(2)} (${report.roi.qualifyingInteractions} interações × R$ ${report.roi.avgTicket!.toFixed(2)} × ${(report.roi.returnRate! * 100).toFixed(0)}%)`
            : "ROI Mode não configurado — configure o ticket médio e a taxa de retorno em Configurações para ver a receita estimada influenciada."}
        </Text>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages} — NFC Review Pro`} fixed />
      </Page>
    </Document>
  );
}
