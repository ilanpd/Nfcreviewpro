/**
 * Estoque de placas (ADR-092) — manifesto CSV que vai para a gráfica
 * (gravação do chip e conferência da entrega). Separador `;` e BOM porque é o
 * que o Excel em português abre sem estragar acentos nem juntar colunas.
 */

export interface ManifestRow {
  serial: string;
  code: string;
  url: string;
  status: string;
  batch: string;
  model: string;
}

const HEADER = ["serie", "codigo", "url", "status", "lote", "modelo"];
const SEPARATOR = ";";
const UTF8_BOM = "﻿";

/**
 * Valor de planilha: aspas dobradas quando precisa, e um apóstrofo na frente
 * de qualquer célula que comece com `=`, `+`, `-` ou `@` — o nome de um modelo
 * é digitado por gente e não pode virar fórmula no Excel de quem recebe.
 */
export function csvCell(value: string): string {
  let cell = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[";\r\n]/.test(cell)) cell = `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export function buildManifestCsv(rows: ManifestRow[]): string {
  const lines = [HEADER, ...rows.map((r) => [r.serial, r.code, r.url, r.status, r.batch, r.model])].map((line) =>
    line.map(csvCell).join(SEPARATOR)
  );
  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}
