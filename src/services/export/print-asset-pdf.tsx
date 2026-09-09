/* eslint-disable jsx-a11y/alt-text -- `Image` aqui é o componente de
   `@react-pdf/renderer` (renderiza dentro de um PDF, não HTML), que não
   tem nem precisa de uma prop `alt`; o linter não distingue pelo nome. */
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { PrintTemplateId } from "@/domain/white-label/print-templates";

export interface PrintAssetData {
  templateId: PrintTemplateId;
  size: [number, number];
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  onPrimary: "#000000" | "#FFFFFF";
  cardName: string;
  qrDataUrl: string;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  logoImg: { objectFit: "contain" },
  qrImg: { objectFit: "contain" },
});

function LogoOrInitial({ data, size }: { data: PrintAssetData; size: number }) {
  if (data.logoUrl) {
    return <Image src={data.logoUrl} style={{ width: size, height: size, ...styles.logoImg }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: data.primaryColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: data.onPrimary, fontSize: size * 0.45, fontWeight: 700 }}>{data.companyName.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/**
 * Impressão Profissional (Fase 10, bônus) — um template por formato físico
 * pedido, todos usando exatamente a identidade White Label da empresa
 * (logo real via URL — `@react-pdf/renderer` busca imagens remotas
 * nativamente, sem precisar converter para data URI antes) e o mesmo QR
 * com cor de marca gerado por `lib/qrcode.ts`. Nenhum canvas/composição de
 * imagem de terceiros — layout puro em `@react-pdf/renderer`, a mesma
 * escolha "sem infraestrutura exótica" do ADR-025/ADR-031.
 */
export function PrintAssetPdf({ data }: { data: PrintAssetData }) {
  const [width, height] = data.size;

  return (
    <Document title={`${data.companyName} — ${data.cardName}`}>
      <Page size={{ width, height }} style={[styles.page, { padding: width * 0.06 }]}>
        {data.templateId === "sticker" && (
          <>
            <LogoOrInitial data={data} size={width * 0.18} />
            <Image src={data.qrDataUrl} style={{ width: width * 0.7, height: width * 0.7, marginTop: 8, ...styles.qrImg }} />
            <Text style={{ fontSize: width * 0.045, color: data.primaryColor, fontWeight: 700, marginTop: 6 }}>{data.companyName}</Text>
          </>
        )}

        {data.templateId === "pvc-card" && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", height: "100%" }}>
            <View style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", flex: 1 }}>
              <LogoOrInitial data={data} size={height * 0.32} />
              <View>
                <Text style={{ fontSize: 9, fontWeight: 700, color: data.primaryColor }}>{data.companyName}</Text>
                <Text style={{ fontSize: 7, color: "#6B7280", marginTop: 2 }}>Avalie sua experiência</Text>
                <Text style={{ fontSize: 6, color: "#9CA3AF", marginTop: 1 }}>{data.cardName}</Text>
              </View>
            </View>
            <Image src={data.qrDataUrl} style={{ width: height * 0.75, height: height * 0.75, ...styles.qrImg }} />
          </View>
        )}

        {data.templateId === "table-tent" && (
          <>
            <Text style={{ fontSize: width * 0.075, fontWeight: 700, color: data.primaryColor, textAlign: "center", marginBottom: 12 }}>
              Avalie sua experiência
            </Text>
            <Image src={data.qrDataUrl} style={{ width: width * 0.72, height: width * 0.72, ...styles.qrImg }} />
            <View style={{ marginTop: 16, display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LogoOrInitial data={data} size={width * 0.12} />
              <Text style={{ fontSize: width * 0.045, fontWeight: 700, color: "#111827" }}>{data.companyName}</Text>
            </View>
            <Text style={{ fontSize: width * 0.035, color: "#9CA3AF", marginTop: 4 }}>{data.cardName}</Text>
          </>
        )}

        {data.templateId === "easel" && (
          <>
            <LogoOrInitial data={data} size={100} />
            <Text style={{ fontSize: 34, fontWeight: 700, color: data.primaryColor, textAlign: "center", marginTop: 24, marginBottom: 8 }}>
              {data.companyName}
            </Text>
            <Text style={{ fontSize: 18, color: "#374151", textAlign: "center", marginBottom: 32 }}>
              Adorou o atendimento? Escaneie e conte pra gente.
            </Text>
            <Image src={data.qrDataUrl} style={{ width: 320, height: 320, ...styles.qrImg }} />
            <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 24 }}>{data.cardName}</Text>
          </>
        )}

        {data.templateId === "plaque" && (
          <View
            style={{
              width: "100%",
              height: "100%",
              borderWidth: 2,
              borderColor: data.primaryColor,
              borderStyle: "solid",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <LogoOrInitial data={data} size={width * 0.22} />
            <Image src={data.qrDataUrl} style={{ width: width * 0.55, height: width * 0.55, marginTop: 12, ...styles.qrImg }} />
            <Text style={{ fontSize: width * 0.055, fontWeight: 700, color: data.primaryColor, marginTop: 10, textAlign: "center" }}>
              Escaneie para avaliar
            </Text>
            <Text style={{ fontSize: width * 0.04, color: "#9CA3AF", marginTop: 2 }}>{data.companyName}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
