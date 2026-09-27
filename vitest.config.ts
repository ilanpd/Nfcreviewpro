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
    // Cobertura só do domínio puro (npm run test:coverage): é onde a regra de
    // negócio mora, e o piso de 90% do Retorno é medido aqui.
    coverage: {
      provider: "v8",
      include: ["src/domain/**"],
      exclude: ["**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
