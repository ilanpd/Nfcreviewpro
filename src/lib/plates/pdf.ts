import {
  PDFDocument,
  StandardFonts,
  fill,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setFillingRgbColor,
  type PDFImage,
} from "pdf-lib";
import { QR_QUIET_MODULES, mmToPt, pageSizeMm, toPdfRect, type PlateLayout } from "@/domain/plates/layout";
import { buildQrMatrix, darkRuns, type QrErrorCorrection } from "@/lib/plates/qr-vector";

/**
 * Estoque de placas (ADR-092) — o PDF que vai para a gráfica. Uma página por
 * placa, no tamanho da área final MAIS a sangria, com `TrimBox`/`BleedBox`
 * declarados (é o que o software da gráfica lê para saber onde cortar). A arte
 * de fundo é embutida UMA vez e reaproveitada em todas as páginas: um lote de
 * 200 placas pesa quase o mesmo que a imagem sozinha, e o arquivo cabe no
 * limite de resposta da Vercel. O QR é desenhado como quadradinhos vetoriais,
 * nunca como imagem.
 *
 * Nada aqui toca banco nem rede: recebe tudo pronto e devolve bytes.
 */

export interface PlatePdfVersion extends PlateLayout {
  background: Uint8Array | null;
  backgroundMime: string | null;
  qrErrorCorrection: QrErrorCorrection;
  qrDarkColor: string;
  qrLightColor: string;
  serialColor: string;
}

export interface PlatePdfItem {
  serial: string;
  url: string;
}

function parseHex(hex: string, fallback: [number, number, number]): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return fallback;
  const value = parseInt(match[1], 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/**
 * Helvetica padrão só entende Latin-1. Travessões e aspas curvas (comuns em
 * títulos) viram o equivalente simples; qualquer outro caractere fora disso
 * vira "?".
 */
function toLatin1(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

/**
 * Abre a imagem exatamente como o PDF vai abri-la — se não der para embutir,
 * o upload é recusado na hora (e não só quando o lote já foi gerado) — e
 * devolve as dimensões em pixels.
 */
export async function inspectBackground(bytes: Uint8Array, mime: string): Promise<{ widthPx: number; heightPx: number }> {
  const doc = await PDFDocument.create();
  const image = mime === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  return { widthPx: image.width, heightPx: image.height };
}

export interface RenderOptions {
  title: string;
  subject?: string;
}

export async function renderPlatePdf(version: PlatePdfVersion, items: PlatePdfItem[], options: RenderOptions): Promise<Uint8Array> {
  if (items.length === 0) throw new Error("Nenhuma placa para gerar.");

  const doc = await PDFDocument.create();
  doc.setTitle(toLatin1(options.title));
  doc.setSubject(toLatin1(options.subject ?? "Arte de produção de placas"));
  doc.setProducer("Pulse Smart Link");
  doc.setCreator("Pulse Smart Link");

  let background: PDFImage | null = null;
  if (version.background && version.backgroundMime) {
    background = version.backgroundMime === "image/png" ? await doc.embedPng(version.background) : await doc.embedJpg(version.background);
  }
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageMm = pageSizeMm(version);
  const pageWidth = mmToPt(pageMm.width);
  const pageHeight = mmToPt(pageMm.height);
  const bleed = mmToPt(version.bleedMm);
  const [lightR, lightG, lightB] = parseHex(version.qrLightColor, [1, 1, 1]);
  const [darkR, darkG, darkB] = parseHex(version.qrDarkColor, [0, 0, 0]);
  const [serialR, serialG, serialB] = parseHex(version.serialColor, [1, 1, 1]);
  const qrBox = toPdfRect(version, { xMm: version.qrXMm, yMm: version.qrYMm, widthMm: version.qrSizeMm, heightMm: version.qrSizeMm });

  for (const item of items) {
    const page = doc.addPage([pageWidth, pageHeight]);
    page.setBleedBox(0, 0, pageWidth, pageHeight);
    page.setTrimBox(bleed, bleed, mmToPt(version.widthMm), mmToPt(version.heightMm));

    if (background) {
      page.drawImage(background, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    } else {
      page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
    }

    // QR: a caixa inteira (com a zona de silêncio) recebe a cor clara, depois
    // todos os módulos escuros entram num único caminho preenchido. Cada
    // retângulo cresce 1,5% do módulo para a direita e para baixo: sem isso,
    // alguns leitores de PDF mostram uma linha clara entre módulos vizinhos.
    const matrix = buildQrMatrix(item.url, version.qrErrorCorrection);
    const cell = qrBox.width / (matrix.size + 2 * QR_QUIET_MODULES);
    const grow = cell * 0.015;
    const ops = [
      pushGraphicsState(),
      setFillingRgbColor(lightR, lightG, lightB),
      rectangle(qrBox.x, qrBox.y, qrBox.width, qrBox.height),
      fill(),
      setFillingRgbColor(darkR, darkG, darkB),
    ];
    for (const run of darkRuns(matrix)) {
      const x = qrBox.x + (QR_QUIET_MODULES + run.col) * cell;
      const yTop = qrBox.y + qrBox.height - (QR_QUIET_MODULES + run.row) * cell;
      ops.push(rectangle(x, yTop - cell - grow, run.length * cell + grow, cell + grow));
    }
    ops.push(fill(), popGraphicsState());
    page.pushOperators(...ops);

    if (version.serialEnabled) {
      const topPt = mmToPt(version.bleedMm + version.heightMm - version.serialYMm);
      page.drawText(toLatin1(item.serial), {
        x: mmToPt(version.bleedMm + version.serialXMm),
        y: topPt - font.heightAtSize(version.serialFontPt, { descender: false }),
        size: version.serialFontPt,
        font,
        color: rgb(serialR, serialG, serialB),
      });
    }
  }

  return doc.save();
}
