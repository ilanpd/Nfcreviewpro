/**
 * Validação de CPF/CNPJ e telefone brasileiro — matemática pura, sem I/O,
 * testável isoladamente (Auditoria do Fluxo de Vendas, 12/09/2026).
 *
 * Antes desta fase, `customerDocumentSchema` só checava a QUANTIDADE de
 * dígitos (11 ou 14) — "11111111111" passava. Isso não travava a compra (o
 * pagamento no Stripe é o que realmente importa ali), mas garantia que um
 * documento inválido só seria descoberto na hora de emitir nota fiscal de
 * verdade, o pior momento possível. O dígito verificador é o mesmo algoritmo
 * público usado pela Receita Federal — não precisa de rede nem de API
 * externa para validar.
 */

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Todos os dígitos iguais (`00000000000`, `11111111111`...) passam pelo
 * cálculo do dígito verificador matematicamente, mas nunca são CPFs/CNPJs
 * reais emitidos — a Receita Federal os rejeita na origem. */
function isAllSameDigit(value: string): boolean {
  return /^(\d)\1*$/.test(value);
}

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || isAllSameDigit(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const checkDigit = (base: number[], factorStart: number) => {
    const sum = base.reduce((acc, digit, i) => acc + digit * (factorStart - i), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstCheck = checkDigit(digits.slice(0, 9), 10);
  if (firstCheck !== digits[9]) return false;
  const secondCheck = checkDigit(digits.slice(0, 10), 11);
  return secondCheck === digits[10];
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || isAllSameDigit(cnpj)) return false;

  const digits = cnpj.split("").map(Number);
  const checkDigit = (base: number[]) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.reduce((acc, digit, i) => acc + digit * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstCheck = checkDigit(digits.slice(0, 12));
  if (firstCheck !== digits[12]) return false;
  const secondCheck = checkDigit(digits.slice(0, 13));
  return secondCheck === digits[13];
}

/** CPF (11 dígitos) ou CNPJ (14) — dígito verificador correto pro tamanho
 * informado. Comprimento diferente de ambos já falha antes de calcular. */
export function isValidCpfOrCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

/** Celular/fixo brasileiro: DDD (11-99, primeiro dígito nunca 0) + 8 dígitos
 * (fixo) ou 9 dígitos começando em 9 (celular). Acompanha código do país
 * opcional (`55`) na frente, já que o Stripe/checkout pode receber o número
 * de qualquer um dos dois formatos. */
export function isValidBrazilianPhone(value: string): boolean {
  let digits = onlyDigits(value);
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith("55")) return false;
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== "9") return false;
  return true;
}
