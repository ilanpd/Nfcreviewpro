import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, decodePDFRawStream } from "pdf-lib";
import jsQR from "jsqr";
import { defaultLayout, mmToPt } from "@/domain/plates/layout";
import { buildQrMatrix, darkRuns } from "./qr-vector";
import { inspectBackground, renderPlatePdf, type PlatePdfVersion } from "./pdf";

// Estoque de placas (ADR-092). Prova de ponta a ponta do que a gráfica recebe:
// o QR do PDF, rasterizado a partir das instruções de desenho que estão
// DENTRO do arquivo, tem que ser lido por um decodificador de QR de verdade e
// dar a URL gravada no chip. Se a geometria (sangria, inversão do eixo Y,
// tamanho do módulo) estivesse errada, a placa sairia impressa com um QR que
// não lê — e só se descobriria com a placa na mão.

// PNG 1x1 branco: o menor arquivo válido, só para exercitar o embed da arte.
const TINY_PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
);

function version(overrides: Partial<PlatePdfVersion> = {}): PlatePdfVersion {
  return {
    ...defaultLayout(),
    background: null,
    backgroundMime: null,
    qrErrorCorrection: "M",
    qrDarkColor: "#000000",
    qrLightColor: "#FFFFFF",
    serialColor: "#FFFFFF",
    ...overrides,
  };
}

async function pageContent(doc: PDFDocument, pageIndex: number): Promise<string> {
  const page = doc.getPage(pageIndex);
  const contents = page.node.Contents();
  const streams: PDFRawStream[] = [];
  if (contents instanceof PDFRawStream) streams.push(contents);
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const ref = contents.get(i);
      const stream = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
      if (stream instanceof PDFRawStream) streams.push(stream);
    }
  }
  return streams.map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString("latin1")).join("\n");
}

/** Rasteriza os retângulos de preenchimento do conteúdo da página (claro, depois escuro). */
function rasterize(content: string, widthPt: number, heightPt: number, scale: number) {
  const width = Math.ceil(widthPt * scale);
  const height = Math.ceil(heightPt * scale);
  const data = new Uint8ClampedArray(width * height * 4).fill(128);
  let color: [number, number, number] = [255, 255, 255];
  const tokens = content.split(/\s+/);
  const stack: number[] = [];
  for (const token of tokens) {
    if (token === "rg") {
      const [r, g, b] = stack.splice(-3);
      color = [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    } else if (token === "re") {
      const [x, y, w, h] = stack.splice(-4);
      const x0 = Math.floor(x * scale);
      const x1 = Math.ceil((x + w) * scale);
      const yTop = Math.floor((heightPt - (y + h)) * scale);
      const yBottom = Math.ceil((heightPt - y) * scale);
      for (let py = Math.max(0, yTop); py < Math.min(height, yBottom); py++) {
        for (let px = Math.max(0, x0); px < Math.min(width, x1); px++) {
          const i = (py * width + px) * 4;
          data[i] = color[0];
          data[i + 1] = color[1];
          data[i + 2] = color[2];
          data[i + 3] = 255;
        }
      }
    } else if (token !== "" && !Number.isNaN(Number(token))) {
      stack.push(Number(token));
    } else if (token !== "") {
      stack.length = 0;
    }
  }
  return { data, width, height };
}

// Prazo de 30 s: rasterizar páginas inteiras e decodificar o QR é conta pesada (~1,5 s
// sozinho), e na suíte inteira, com a máquina carregada, passa dos 5 s padrão.
describe("renderPlatePdf", { timeout: 30_000 }, () => {
  const items = [
    { serial: "L001-01", url: "https://pulsesmartlink.com.br/r/abcd2345" },
    { serial: "L001-02", url: "https://pulsesmartlink.com.br/r/efgh6789" },
  ];

  it("gera um PDF com uma página por placa, no tamanho da área final mais sangria", async () => {
    const bytes = await renderPlatePdf(version(), items, { title: "Lote L001" });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(mmToPt(106), 3);
    expect(height).toBeCloseTo(mmToPt(106), 3);
  });

  it("declara TrimBox e BleedBox — é o que a gráfica lê para saber onde cortar", async () => {
    const doc = await PDFDocument.load(await renderPlatePdf(version(), items, { title: "t" }));
    const page = doc.getPage(0);
    const trim = page.getTrimBox();
    const bleed = page.getBleedBox();
    expect(trim.x).toBeCloseTo(mmToPt(3), 3);
    expect(trim.width).toBeCloseTo(mmToPt(100), 3);
    expect(bleed.x).toBeCloseTo(0, 3);
    expect(bleed.width).toBeCloseTo(mmToPt(106), 3);
  });

  it("o QR do PDF, rasterizado das instruções do próprio arquivo, é lido por um decodificador real e dá a URL do chip", async () => {
    const doc = await PDFDocument.load(await renderPlatePdf(version(), items, { title: "t" }));
    for (let i = 0; i < items.length; i++) {
      const size = doc.getPage(i).getSize();
      const content = await pageContent(doc, i);
      const image = rasterize(content, size.width, size.height, 6);
      const result = jsQR(image.data, image.width, image.height);
      expect(result?.data).toBe(items[i].url);
    }
  });

  it("continua legível com cinza-escuro sobre quase-branco (cores próximas do preto e branco)", async () => {
    const custom = version({ qrDarkColor: "#111111", qrLightColor: "#FAFAFA" });
    const doc = await PDFDocument.load(await renderPlatePdf(custom, [items[0]], { title: "t" }));
    const size = doc.getPage(0).getSize();
    const image = rasterize(await pageContent(doc, 0), size.width, size.height, 6);
    expect(jsQR(image.data, image.width, image.height)?.data).toBe(items[0].url);
  });

  it("embute a arte de fundo UMA vez, não uma por página (arquivo leve e dentro do limite de resposta)", async () => {
    const withArt = version({ background: TINY_PNG, backgroundMime: "image/png" });
    const many = Array.from({ length: 30 }, (_, i) => ({ serial: `L001-${String(i + 1).padStart(2, "0")}`, url: `https://x.com.br/r/code${i}abc` }));
    const countImages = async (list: typeof many) => {
      const doc = await PDFDocument.load(await renderPlatePdf(withArt, list, { title: "t" }));
      let images = 0;
      for (const [, object] of doc.context.enumerateIndirectObjects()) {
        const dict = object instanceof PDFRawStream ? object.dict : object instanceof PDFDict ? object : null;
        if (dict?.get(PDFName.of("Subtype")) === PDFName.of("Image")) images++;
      }
      return { images, pages: doc.getPageCount() };
    };
    // Um PNG com canal alfa vira 2 objetos de imagem (a arte + a máscara) — o
    // que importa é que 30 páginas não tenham mais objetos de imagem que 1.
    const one = await countImages(many.slice(0, 1));
    const thirty = await countImages(many);
    expect(thirty.pages).toBe(30);
    expect(thirty.images).toBeGreaterThan(0);
    expect(thirty.images).toBe(one.images);
  });

  it("recusa gerar sem nenhuma placa", async () => {
    await expect(renderPlatePdf(version(), [], { title: "t" })).rejects.toThrow(/Nenhuma placa/);
  });

  it("travessão e aspas curvas no título viram os simples, não '?'", async () => {
    const bytes = await renderPlatePdf(version(), [items[0]], { title: "Lote L001 — Avaliação “10x10”" });
    expect((await PDFDocument.load(bytes)).getTitle()).toBe('Lote L001 - Avaliação "10x10"');
  });

  it("aceita série fora do Latin-1 sem quebrar (vira '?')", async () => {
    const bytes = await renderPlatePdf(version(), [{ serial: "L001-01 ✓", url: "https://x.com.br/r/abc12345" }], { title: "Lote ✓" });
    expect(bytes.length).toBeGreaterThan(500);
  });
});

describe("inspectBackground", () => {
  it("devolve as dimensões de uma imagem válida e recusa arquivo que não é imagem", async () => {
    expect(await inspectBackground(TINY_PNG, "image/png")).toEqual({ widthPx: 1, heightPx: 1 });
    await expect(inspectBackground(Uint8Array.from([1, 2, 3, 4]), "image/png")).rejects.toThrow();
  });
});

describe("corridas de módulos escuros", () => {
  it("reconstroem exatamente a matriz do QR (nada some, nada sobra)", () => {
    const matrix = buildQrMatrix("https://pulsesmartlink.com.br/r/abcd2345", "M");
    const rebuilt = Array.from({ length: matrix.size }, () => Array<boolean>(matrix.size).fill(false));
    for (const run of darkRuns(matrix)) for (let c = 0; c < run.length; c++) rebuilt[run.row][run.col + c] = true;
    for (let r = 0; r < matrix.size; r++) for (let c = 0; c < matrix.size; c++) expect(rebuilt[r][c]).toBe(matrix.isDark(r, c));
  });

  it("um endereço curto gera um QR menos denso (módulos maiores na mesma placa)", () => {
    const short = buildQrMatrix("https://p.com.br/r/abcd2345", "M").size;
    const long = buildQrMatrix("https://nfc-os-production.vercel.app/r/abcd2345", "M").size;
    expect(short).toBeLessThan(long);
  });
});
