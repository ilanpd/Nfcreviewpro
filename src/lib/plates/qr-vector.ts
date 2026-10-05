import QRCode from "qrcode";

/**
 * Estoque de placas (ADR-092) — QR como GEOMETRIA, não como imagem. A gráfica
 * recebe quadradinhos vetoriais (nítidos em qualquer tamanho de impressão), e
 * não um PNG que ela possa reamostrar. Este módulo só extrai a matriz de
 * módulos do `qrcode`; desenhar fica por conta de quem gera o PDF.
 */

export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export interface QrMatrix {
  /** Módulos por lado (sem a zona de silêncio). */
  size: number;
  isDark(row: number, col: number): boolean;
}

export function buildQrMatrix(text: string, errorCorrection: QrErrorCorrection = "M"): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: errorCorrection });
  const { size } = qr.modules;
  return { size, isDark: (row, col) => qr.modules.get(row, col) === 1 };
}

export interface DarkRun {
  row: number;
  col: number;
  length: number;
}

/**
 * Junta módulos escuros vizinhos da mesma linha num retângulo só. Um QR de 33
 * módulos tem ~500 quadradinhos escuros; em corridas caem para uns 200, e o
 * PDF de um lote de 200 placas fica leve de verdade.
 */
export function darkRuns(matrix: QrMatrix): DarkRun[] {
  const runs: DarkRun[] = [];
  for (let row = 0; row < matrix.size; row++) {
    let start = -1;
    for (let col = 0; col <= matrix.size; col++) {
      const dark = col < matrix.size && matrix.isDark(row, col);
      if (dark && start === -1) start = col;
      if (!dark && start !== -1) {
        runs.push({ row, col: start, length: col - start });
        start = -1;
      }
    }
  }
  return runs;
}
