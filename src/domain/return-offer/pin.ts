/**
 * PIN da loja (ADR-078): 4 dígitos que só a equipe conhece. O valor nunca é
 * guardado (só o hash, no serviço); aqui ficam as regras puras de formato,
 * de PIN fraco demais e de limite de tentativas.
 */
export const PIN_LENGTH = 4;
export const PIN_MAX_FAILURES = 5;
export const PIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * PIN que qualquer cliente tentaria primeiro: todos os dígitos iguais
 * (0000, 1111) ou sequência corrida (1234, 4321, 2345). O dono é impedido de
 * escolhê-los ao configurar.
 */
export function isWeakPin(pin: string): boolean {
  if (!isValidPinFormat(pin)) return true;
  const digits = [...pin].map(Number);
  if (digits.every((d) => d === digits[0])) return true;
  const steps = digits.slice(1).map((d, i) => d - digits[i]);
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

export type PinAttemptDecision = { allowed: true; remaining: number } | { allowed: false; retryAt: Date };

/**
 * Quantas tentativas erradas ainda cabem: `maxFailures` por janela deslizante
 * de `windowMs`. Bloqueado até a falha que o bloqueia sair da janela.
 */
export function evaluatePinAttempts(input: {
  failures: Date[];
  now: Date;
  maxFailures?: number;
  windowMs?: number;
}): PinAttemptDecision {
  const maxFailures = input.maxFailures ?? PIN_MAX_FAILURES;
  const windowMs = input.windowMs ?? PIN_ATTEMPT_WINDOW_MS;
  const since = input.now.getTime() - windowMs;
  const recent = input.failures
    .map((f) => f.getTime())
    .filter((t) => t > since)
    .sort((a, b) => a - b);
  if (recent.length < maxFailures) return { allowed: true, remaining: maxFailures - recent.length };
  // A tentativa volta a ser permitida quando a falha que a bloqueia sai da janela.
  const blocking = recent[recent.length - maxFailures];
  return { allowed: false, retryAt: new Date(blocking + windowMs) };
}
