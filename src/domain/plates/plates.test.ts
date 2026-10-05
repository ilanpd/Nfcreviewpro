import { describe, expect, it } from "vitest";
import { formatBatchCode, formatSerial, nextBatchCode, parseSerial, serialDigits } from "./serial";
import {
  allChecked,
  canAssign,
  canRestore,
  canRetire,
  derivePlateStage,
  statusAfterChecks,
} from "./status";
import { defaultLayout, effectiveDpi, mmToPt, pageSizeMm, qrModuleSizeMm, toPdfRect, validateLayout } from "./layout";
import { buildManifestCsv, csvCell } from "./manifest";
import { MAX_DELIVERABLE_BYTES, MAX_SINGLE_PAGE_PDF_BYTES, artProblem, deliverableProblem } from "./limits";
import { emptyCounts, findLowStock, summarizeByModel } from "./stock-summary";

describe("série da placa", () => {
  it("o código do lote tem 3 casas e a série usa pelo menos 2 casas de posição", () => {
    expect(formatBatchCode(1)).toBe("L001");
    expect(formatBatchCode(42)).toBe("L042");
    expect(formatSerial("L001", 7, 20)).toBe("L001-07");
  });

  it("lote grande ganha mais casas na posição, para a ordenação alfabética continuar certa", () => {
    expect(serialDigits(99)).toBe(2);
    expect(serialDigits(100)).toBe(3);
    expect(formatSerial("L003", 7, 250)).toBe("L003-007");
  });

  it("recusa posição fora do lote e sequência inválida", () => {
    expect(() => formatSerial("L001", 0, 20)).toThrow();
    expect(() => formatSerial("L001", 21, 20)).toThrow();
    expect(() => formatBatchCode(0)).toThrow();
  });

  it("entende o que se digita na loja com pressa e devolve números, não texto", () => {
    expect(parseSerial("L001-07")).toEqual({ batchCode: "L001", index: 7 });
    expect(parseSerial("l001-7")).toEqual({ batchCode: "L001", index: 7 });
    expect(parseSerial("  L1 / 7 ")).toEqual({ batchCode: "L001", index: 7 });
    expect(parseSerial("001-07")).toEqual({ batchCode: "L001", index: 7 });
    expect(parseSerial("L003-007")).toEqual({ batchCode: "L003", index: 7 });
  });

  it("recusa o que é ambíguo ou lixo (sem separador, zeros, letras)", () => {
    expect(parseSerial("L00107")).toBeNull();
    expect(parseSerial("L000-01")).toBeNull();
    expect(parseSerial("L001-00")).toBeNull();
    expect(parseSerial("abc")).toBeNull();
    expect(parseSerial("")).toBeNull();
  });

  it("o próximo lote vem depois do maior existente, ignorando códigos estranhos", () => {
    expect(nextBatchCode([])).toBe("L001");
    expect(nextBatchCode(["L001", "L007", "L003"])).toBe("L008");
    expect(nextBatchCode(["X1", "L002"])).toBe("L003");
  });
});

describe("estado da placa", () => {
  it("'em estoque' e 'com cliente' derivam de conferida + dono, nunca de um campo próprio", () => {
    expect(derivePlateStage({ status: "VERIFIED", cardId: null })).toBe("IN_STOCK");
    expect(derivePlateStage({ status: "VERIFIED", cardId: "c1" })).toBe("ASSIGNED");
    expect(derivePlateStage({ status: "IN_PRODUCTION", cardId: "c1" })).toBe("IN_PRODUCTION");
    expect(derivePlateStage({ status: "DEFECTIVE", cardId: null })).toBe("DEFECTIVE");
    expect(derivePlateStage({ status: "VOIDED", cardId: null })).toBe("VOIDED");
  });

  it("só vira conferida com as três checagens, e desmarcar uma desfaz a conferência", () => {
    const all = { nfcChecked: true, qrChecked: true, serialChecked: true };
    expect(allChecked(all)).toBe(true);
    expect(statusAfterChecks("IN_PRODUCTION", all)).toBe("VERIFIED");
    expect(statusAfterChecks("GENERATED", { ...all, qrChecked: false })).toBe("IN_PRODUCTION");
    expect(statusAfterChecks("VERIFIED", { ...all, serialChecked: false })).toBe("IN_PRODUCTION");
  });

  it("placa defeituosa ou anulada não muda de estado pela conferência", () => {
    const all = { nfcChecked: true, qrChecked: true, serialChecked: true };
    expect(statusAfterChecks("DEFECTIVE", all)).toBe("DEFECTIVE");
    expect(statusAfterChecks("VOIDED", all)).toBe("VOIDED");
  });

  it("só se entrega ao cliente uma placa conferida e sem dono", () => {
    expect(canAssign({ status: "VERIFIED", cardId: null })).toBe(true);
    expect(canAssign({ status: "VERIFIED", cardId: "c1" })).toBe(false);
    expect(canAssign({ status: "IN_PRODUCTION", cardId: null })).toBe(false);
    expect(canAssign({ status: "DEFECTIVE", cardId: null })).toBe(false);
  });

  it("placa com dono não se descarta direto — é uma troca", () => {
    expect(canRetire({ status: "VERIFIED", cardId: "c1" })).toBe(false);
    expect(canRetire({ status: "VERIFIED", cardId: null })).toBe(true);
    expect(canRetire({ status: "DEFECTIVE", cardId: null })).toBe(false);
    expect(canRestore({ status: "DEFECTIVE" })).toBe(true);
    expect(canRestore({ status: "VERIFIED" })).toBe(false);
  });
});

describe("geometria da arte", () => {
  const layout = defaultLayout();

  it("a página é a área final mais a sangria nos quatro lados", () => {
    expect(pageSizeMm({ widthMm: 100, heightMm: 100, bleedMm: 3 })).toEqual({ width: 106, height: 106 });
  });

  it("converte milímetros em pontos do PDF (72 pt por polegada)", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 6);
  });

  it("a caixa do QR vira coordenadas do PDF com origem embaixo à esquerda, contando a sangria", () => {
    const rect = toPdfRect({ heightMm: 100, bleedMm: 3 }, { xMm: 10, yMm: 20, widthMm: 40, heightMm: 40 });
    expect(rect.x).toBeCloseTo(mmToPt(13), 6);
    // topo do QR a 20 mm do topo da área final → 100 - 20 - 40 = 40 mm da base, mais 3 mm de sangria
    expect(rect.y).toBeCloseTo(mmToPt(43), 6);
    expect(rect.width).toBeCloseTo(mmToPt(40), 6);
  });

  it("o layout padrão é válido e sem avisos de tamanho", () => {
    const check = validateLayout(layout, { qrModules: 29 });
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([]);
  });

  it("QR para fora da área final é erro (invadir a sangria corta o QR na gráfica)", () => {
    const check = validateLayout({ ...layout, qrXMm: 80, qrSizeMm: 38 });
    expect(check.errors.join(" ")).toMatch(/dentro da área final/);
  });

  it("QR pequeno ou com módulo minúsculo vira aviso, não erro", () => {
    const small = validateLayout({ ...layout, qrXMm: 10, qrYMm: 10, qrSizeMm: 12 });
    expect(small.errors).toEqual([]);
    expect(small.warnings.join(" ")).toMatch(/abaixo de 15 mm/);

    // 29 módulos + 8 de silêncio em 18 mm = 0,49 mm por módulo
    const dense = validateLayout({ ...layout, qrXMm: 10, qrYMm: 10, qrSizeMm: 18 }, { qrModules: 29 });
    expect(dense.warnings.join(" ")).toMatch(/quadradinho/);
    expect(qrModuleSizeMm(38, 29)).toBeCloseTo(38 / 37, 6);
  });

  it("arte com poucos dpi ou proporção errada avisa antes de imprimir", () => {
    // 106 mm = 4,17 pol → 600 px dá ~144 dpi
    const lowRes = validateLayout(layout, { background: { widthPx: 600, heightPx: 600 } });
    expect(lowRes.warnings.join(" ")).toMatch(/dpi/);
    expect(effectiveDpi(1252, 106)).toBeGreaterThan(299);

    const stretched = validateLayout(layout, { background: { widthPx: 1252, heightPx: 1000 } });
    expect(stretched.warnings.join(" ")).toMatch(/esticada/);
  });

  it("arte boa em 300 dpi não gera aviso", () => {
    const ok = validateLayout(layout, { qrModules: 29, background: { widthPx: 1252, heightPx: 1252 } });
    expect(ok.warnings).toEqual([]);
  });
});

describe("limites de tamanho dos arquivos", () => {
  const MB = 1024 * 1024;

  it("arquivo dentro do que a Vercel entrega passa; acima disso avisa o que fazer, antes de a plataforma recusar", () => {
    expect(deliverableProblem(1 * MB)).toBeNull();
    expect(deliverableProblem(MAX_DELIVERABLE_BYTES)).toBeNull();
    const problem = deliverableProblem(5 * MB);
    expect(problem).toMatch(/5,0 MB/);
    expect(problem).toMatch(/Reimprimir só estas/);
    expect(problem).toMatch(/JPG/);
  });

  it("o limite de entrega fica abaixo dos 4,5 MB da plataforma", () => {
    expect(MAX_DELIVERABLE_BYTES).toBeLessThan(4.5 * MB);
  });

  it("arte cujo PDF de uma página já é grande demais é recusada no upload, com o conselho de usar JPG", () => {
    expect(artProblem(100 * 1024)).toBeNull();
    expect(artProblem(MAX_SINGLE_PAGE_PDF_BYTES)).toBeNull();
    const problem = artProblem(4 * MB);
    expect(problem).toMatch(/4,0 MB/);
    expect(problem).toMatch(/JPG/);
  });

  it("sobra espaço para as páginas do lote: o teto da arte é menor que o teto de entrega", () => {
    expect(MAX_SINGLE_PAGE_PDF_BYTES).toBeLessThan(MAX_DELIVERABLE_BYTES);
  });
});

describe("manifesto CSV para a gráfica", () => {
  it("começa com BOM, usa ; e termina cada linha com CRLF (abre certo no Excel em português)", () => {
    const csv = buildManifestCsv([{ serial: "L001-01", code: "abcd2345", url: "https://x.com.br/r/abcd2345", status: "Gerada", batch: "L001", model: "Avaliação" }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("serie;codigo;url;status;lote;modelo");
    expect(lines[1]).toBe("L001-01;abcd2345;https://x.com.br/r/abcd2345;Gerada;L001;Avaliação");
    expect(lines[2]).toBe("");
  });

  it("protege contra fórmula de planilha e escapa ; aspas e quebra de linha", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+55")).toBe("'+55");
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell("linha1\nlinha2")).toBe('"linha1\nlinha2"');
    expect(csvCell("normal")).toBe("normal");
  });
});

describe("resumo de estoque", () => {
  it("conta por modelo usando o mesmo estado derivado do resto do produto", () => {
    const byModel = summarizeByModel([
      { modelId: "a", status: "VERIFIED", cardId: null },
      { modelId: "a", status: "VERIFIED", cardId: null },
      { modelId: "a", status: "VERIFIED", cardId: "c1" },
      { modelId: "a", status: "IN_PRODUCTION", cardId: null },
      { modelId: "b", status: "DEFECTIVE", cardId: null },
    ]);
    expect(byModel.a.IN_STOCK).toBe(2);
    expect(byModel.a.ASSIGNED).toBe(1);
    expect(byModel.a.IN_PRODUCTION).toBe(1);
    expect(byModel.b.DEFECTIVE).toBe(1);
    expect(byModel.b.IN_STOCK).toBe(0);
  });

  it("alerta de estoque baixo ignora modelo inativo e modelo com mínimo 0", () => {
    const byModel = { a: { ...emptyCounts(), IN_STOCK: 2, IN_PRODUCTION: 10 } };
    const low = findLowStock(
      [
        { id: "a", name: "Avaliação", minStock: 5, active: true },
        { id: "b", name: "Universal", minStock: 5, active: false },
        { id: "c", name: "Mesa", minStock: 0, active: true },
        { id: "d", name: "Siga", minStock: 3, active: true },
      ],
      byModel
    );
    expect(low.map((l) => l.modelId)).toEqual(["a", "d"]);
    expect(low[0]).toMatchObject({ inStock: 2, minStock: 5, incoming: 10 });
    expect(low[1]).toMatchObject({ inStock: 0, incoming: 0 });
  });

  it("estoque exatamente no mínimo não alerta", () => {
    const low = findLowStock([{ id: "a", name: "A", minStock: 5, active: true }], { a: { ...emptyCounts(), IN_STOCK: 5 } });
    expect(low).toEqual([]);
  });
});
