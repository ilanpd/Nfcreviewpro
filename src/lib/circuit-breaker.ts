import { log } from "@/lib/observability/logger";

/**
 * Segurança operacional (Fase 8) — Circuit Breaker genérico para qualquer
 * chamada a um serviço externo (hoje: o worker de webhooks; amanhã,
 * qualquer outra integração de saída). Três estados clássicos:
 *   - CLOSED: chamadas passam normalmente.
 *   - OPEN: chamadas são recusadas imediatamente (sem nem tentar a rede),
 *     por `resetTimeoutMs`, depois de `failureThreshold` falhas seguidas —
 *     protege o serviço externo de ser martelado enquanto está fora do ar,
 *     e protege o próprio worker de gastar tempo/tentativas em algo que já
 *     se sabe que vai falhar.
 *   - HALF_OPEN: passado o timeout, UMA chamada de teste é permitida; se
 *     funcionar, fecha o circuito de novo, se falhar, reabre.
 *
 * Em memória, por processo — correto para um único worker; múltiplos
 * workers em paralelo cada um mantém seu próprio estado, o que é aceitável
 * aqui (o pior caso é redundância de tentativas entre workers, não uma
 * falha de segurança).
 */
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 30_000
  ) {}

  getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() - this.openedAt >= this.resetTimeoutMs) {
      this.state = "HALF_OPEN";
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === "OPEN") {
      throw new Error(`Circuit breaker "${this.name}" está aberto — chamada recusada sem tentar a rede`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.consecutiveFailures = 0;
    if (this.state !== "CLOSED") {
      log.info("circuit-breaker", `Circuito "${this.name}" fechado novamente após sucesso`);
    }
    this.state = "CLOSED";
  }

  private onFailure() {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
      log.error("circuit-breaker", `Circuito "${this.name}" aberto após ${this.consecutiveFailures} falhas seguidas`);
    }
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string): CircuitBreaker {
  if (!breakers.has(name)) breakers.set(name, new CircuitBreaker(name));
  return breakers.get(name)!;
}
