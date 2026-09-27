import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Testes (Fase 18, achado na revisão noturna) — zero cobertura automatizada
 * existia antes disto, num produto que já processa pagamentos reais. Escopo
 * deliberadamente restrito a lógica pura (`domain/`, funções de `lib/` sem
 * I/O) — nada aqui toca banco/Stripe/Clerk, então não precisa de mocks
 * pesados nem de variáveis de ambiente reais para rodar.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
