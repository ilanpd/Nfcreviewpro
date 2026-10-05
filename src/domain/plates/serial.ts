/**
 * Estoque de placas (ADR-092) — numeração. A série ("L001-07") é o que a
 * pessoa lê na placa e digita no painel; o código da URL (8 letras
 * aleatórias) fica escondido no chip e no QR. As duas coisas nunca se
 * misturam: série é para humanos, código é para a máquina.
 */

/** "L001", "L002"… — o prefixo de toda série de um lote. */
export function formatBatchCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("A sequência do lote precisa ser um inteiro a partir de 1.");
  return `L${String(sequence).padStart(3, "0")}`;
}

/** Casas da posição dentro do lote: 2 até 99 placas, 3 até 999 etc. */
export function serialDigits(quantity: number): number {
  return Math.max(2, String(Math.max(1, Math.floor(quantity))).length);
}

export function formatSerial(batchCode: string, index: number, quantity: number): string {
  if (!Number.isInteger(index) || index < 1 || index > quantity) {
    throw new Error(`A posição ${index} está fora do lote (1 a ${quantity}).`);
  }
  return `${batchCode}-${String(index).padStart(serialDigits(quantity), "0")}`;
}

export interface ParsedSerial {
  batchCode: string;
  index: number;
}

/**
 * Aceita o que alguém realmente digita na loja, com pressa: "l001-7",
 * "L001 07", "L1/7", "001-07". Devolve o lote e a posição como NÚMEROS, para
 * a busca não depender de quantos zeros o lote usou na hora de imprimir.
 * Sem separador ("L00107") é ambíguo e é recusado de propósito.
 */
export function parseSerial(raw: string): ParsedSerial | null {
  const match = /^L?\s*0*(\d{1,4})\s*[-_/.\s]\s*0*(\d{1,4})$/i.exec(raw.trim());
  if (!match) return null;
  const batchNumber = Number(match[1]);
  const index = Number(match[2]);
  if (batchNumber < 1 || index < 1) return null;
  return { batchCode: formatBatchCode(batchNumber), index };
}

/** Próximo código de lote a partir do maior já existente ("L007" → "L008"). */
export function nextBatchCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^L(\d+)$/.exec(code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return formatBatchCode(max + 1);
}
