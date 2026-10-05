import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface ProductionSheetData {
  batchCode: string;
  modelName: string;
  modelVersion: number;
  createdAt: string;
  supplier: string | null;
  notes: string | null;
  quantity: number;
  addressHost: string;
  addressFinal: boolean;
  spec: { label: string; value: string }[];
  rows: { serial: string; code: string; url: string }[];
  artFileName: string;
  csvFileName: string;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 36, color: "#111827" },
  title: { fontSize: 18, fontWeight: 700 },
  subtitle: { fontSize: 10, color: "#4B5563", marginTop: 2 },
  section: { marginTop: 14 },
  heading: { fontSize: 10, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6, color: "#374151" },
  specRow: { flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  specLabel: { width: 150, color: "#6B7280" },
  specValue: { flex: 1 },
  step: { flexDirection: "row", marginBottom: 3 },
  stepNumber: { width: 14, fontWeight: 700 },
  stepText: { flex: 1 },
  warning: { marginTop: 10, padding: 6, borderWidth: 1, borderColor: "#D97706", color: "#92400E" },
  tableHead: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#111827", fontWeight: 700 },
  tableRow: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  colSerial: { width: 62 },
  colCode: { width: 66 },
  colUrl: { flex: 1 },
  colCheck: { width: 34, textAlign: "center" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: "#9CA3AF", flexDirection: "row", justifyContent: "space-between" },
});

const STEPS = (data: ProductionSheetData) => [
  `Imprimir a arte do arquivo ${data.artFileName}: uma página por placa, com sangria; o corte (TrimBox) está declarado no PDF.`,
  `Gravar no chip NFC de cada placa a URL da coluna "URL" desta ficha ou do arquivo ${data.csvFileName} (registro NDEF do tipo URI), respeitando a série.`,
  "Testar a leitura de cada chip e, só depois, travar a escrita (somente leitura). A URL nunca precisa mudar: o destino é trocado no servidor.",
  "Conferir que o QR impresso e a URL gravada no chip são da MESMA placa (a série impressa deve bater com a desta ficha).",
  "Devolver a ficha com as colunas OK e DEF marcadas (aprovada / com defeito) e identificar claramente qualquer placa recusada.",
];

/**
 * Estoque de placas (ADR-092) — a ficha que acompanha o lote até a gráfica:
 * o que imprimir, em que medida, o que gravar no chip e a lista por série. É
 * também a folha de conferência na chegada (colunas OK/DEF). Texto puro,
 * `@react-pdf/renderer`, sem imagens.
 */
export function PlateProductionSheet({ data }: { data: ProductionSheetData }) {
  return (
    <Document title={`Ficha de produção ${data.batchCode}`} author="Pulse Smart Link">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Ficha de produção — lote {data.batchCode}</Text>
        <Text style={styles.subtitle}>
          {data.modelName} (versão da arte {data.modelVersion}) · {data.quantity} {data.quantity === 1 ? "placa" : "placas"} · gerado em {data.createdAt}
          {data.supplier ? ` · fornecedor: ${data.supplier}` : ""}
        </Text>

        {!data.addressFinal ? (
          <Text style={styles.warning}>
            Atenção: o endereço do cartão ({data.addressHost}) ainda é PROVISÓRIO. Não imprima nem grave chips em escala antes de confirmar o domínio definitivo.
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>Especificação da arte</Text>
          {data.spec.map((item) => (
            <View key={item.label} style={styles.specRow}>
              <Text style={styles.specLabel}>{item.label}</Text>
              <Text style={styles.specValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>O que fazer</Text>
          {STEPS(data).map((step, i) => (
            <View key={step} style={styles.step}>
              <Text style={styles.stepNumber}>{i + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          {data.notes ? <Text style={{ marginTop: 6 }}>Observações: {data.notes}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Placas do lote</Text>
          <View style={styles.tableHead} fixed>
            <Text style={styles.colSerial}>Série</Text>
            <Text style={styles.colCode}>Código</Text>
            <Text style={styles.colUrl}>URL (chip e QR)</Text>
            <Text style={styles.colCheck}>OK</Text>
            <Text style={styles.colCheck}>DEF</Text>
          </View>
          {data.rows.map((row) => (
            <View key={row.serial} style={styles.tableRow} wrap={false}>
              <Text style={styles.colSerial}>{row.serial}</Text>
              <Text style={styles.colCode}>{row.code}</Text>
              <Text style={styles.colUrl}>{row.url}</Text>
              <Text style={styles.colCheck}>[ ]</Text>
              <Text style={styles.colCheck}>[ ]</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Pulse Smart Link · lote {data.batchCode}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
