/**
 * Demo OS (Fase 12) — tipos compartilhados. Um "cenário" nunca fabrica uma
 * tela; ele executa ações REAIS contra os MESMOS motores do produto
 * (`services/*`) e publica eventos REAIS no Event Bus — Zero Fake Demo.
 * O "Live Sandbox" (Dev Runtime) decide QUEM está logado; o Scenario Engine
 * decide O QUE acontece na empresa de demonstração enquanto isso.
 */
export type ScenarioId =
  | "happy-hour"
  | "restaurante-lotado"
  | "avaliacoes-disparando"
  | "zona-silenciosa"
  | "franquia"
  | "falha-redis"
  | "autopilot-trabalhando";

export interface ScenarioStepResult {
  id: string;
  narration: string;
  detail: string;
}

export interface ScenarioRunResult {
  scenarioId: ScenarioId;
  steps: ScenarioStepResult[];
  startedAt: string;
  finishedAt: string;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  description: string;
  /** Sistemas reais que este cenário liga ao mesmo tempo — mostrado na UI
   * como prova de que não é um efeito visual isolado. */
  systemsInvolved: string[];
}

export const SCENARIO_CATALOG: ScenarioDefinition[] = [
  {
    id: "happy-hour",
    name: "Happy Hour",
    description: "Uma rajada de toques reais na Varanda, no horário nobre — o suficiente para o Playbook Engine perceber o padrão e recomendar de verdade.",
    systemsInvolved: ["Resolution Engine", "Event Bus", "Analytics", "Playbook Engine"],
  },
  {
    id: "restaurante-lotado",
    name: "Restaurante lotado",
    description: "Uma rajada de toques reais em todas as zonas ao mesmo tempo — o salão inteiro reagindo junto.",
    systemsInvolved: ["Resolution Engine", "Event Bus", "Analytics", "Heatmap"],
  },
  {
    id: "avaliacoes-disparando",
    name: "Avaliações disparando",
    description: "Uma onda real de avaliações 5 estrelas chegando — o funil e os KPIs reagem ao vivo.",
    systemsInvolved: ["Analytics", "Insight Engine", "Event Bus"],
  },
  {
    id: "zona-silenciosa",
    name: "Zona silenciosa",
    description: "Reavalia os Playbooks agora — se alguma mesa/zona real já está silenciosa além do padrão, a recomendação aparece.",
    systemsInvolved: ["Playbook Engine", "Heatmap"],
  },
  {
    id: "franquia",
    name: "Franquia",
    description: "Troca instantânea de marca entre empresas reais — a mesma tela, quatro identidades diferentes.",
    systemsInvolved: ["White Label", "BrandProvider"],
  },
  {
    id: "falha-redis",
    name: "Falha de Redis",
    description: "Liga o Chaos Mode de verdade (redisDown) por 60 segundos — o cache cai, o Postgres assume, nada quebra.",
    systemsInvolved: ["Chaos Mode", "Resolution Engine", "Cache"],
  },
  {
    id: "autopilot-trabalhando",
    name: "AutoPilot trabalhando",
    description: "Gera uma recomendação de alta confiança e deixa o AutoPilot aplicá-la sozinho, com log completo e Desfazer disponível.",
    systemsInvolved: ["Playbook Engine", "AutoPilot", "Event Bus"],
  },
];
