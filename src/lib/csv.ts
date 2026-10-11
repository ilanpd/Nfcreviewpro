/**
 * Planilha (CSV) injection: um texto que começa com `=`, `+`, `-`, `@`, TAB ou CR é executado como FÓRMULA quando o
 * arquivo é aberto no Excel/Sheets (`=HYPERLINK("https://golpe","Clique")`, `=IMPORTXML(...)` para vazar dados).
 * Os exportáveis carregam texto escrito por terceiros (mensagem de cliente, nome de quem comprou na loja), então
 * a célula é neutralizada com um apóstrofo na frente (a recomendação da OWASP): o texto aparece igual, mas nunca roda.
 *
 * Números (e texto que é só número/telefone, sem letras) ficam como estão: sem letra não há função nem referência
 * de célula, só aritmética inofensiva. Ex.: `-5`, `+55 (11) 99999-9999`.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER_OR_PHONE = /^[+-]?[\d\s().,-]+$/;

function neutralizeFormula(value: unknown, str: string): string {
  if (typeof value !== "string") return str; // número, data, booleano: nunca é fórmula
  return FORMULA_START.test(str) && !PLAIN_NUMBER_OR_PHONE.test(str) ? `'${str}` : str;
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const str = neutralizeFormula(value, raw);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: { key: keyof T; header: string }[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(","));
  return [header, ...body].join("\n");
}
