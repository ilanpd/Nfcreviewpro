import fs from "node:fs";
import path from "node:path";

export interface DevStatus {
  generatedAt: string;
  overallPercent: number;
  phases: { id: number; name: string; status: "done" | "in_progress" | "planned"; summary: string }[];
  modules: { name: string; status: "done" | "in_progress" | "planned" }[];
  changelog: { date: string; phase: number | null; text: string }[];
  nextTask: string;
  knownRisks: string[];
  architecture: { name: string; description: string }[];
  qualityGates: { name: string; passing: boolean }[];
}

/** Single source of truth for both /dev (build log style) and /dev/ceo
 * (executive summary style) — same data, two different lenses. */
export function readDevStatus(): DevStatus {
  const filePath = path.join(process.cwd(), "dev-status.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/** Conta as ADRs em DECISOES_DE_ARQUITETURA.md diretamente do arquivo, em
 * vez de duplicar o número em dev-status.json — assim o "Painel CEO" nunca
 * fica desatualizado quando uma nova ADR é adicionada numa fase futura. */
export function countArchitectureDecisions(): number {
  try {
    const filePath = path.join(process.cwd(), "DECISOES_DE_ARQUITETURA.md");
    const content = fs.readFileSync(filePath, "utf-8");
    const matches = content.match(/^## ADR-\d+:/gm);
    return matches?.length ?? 0;
  } catch {
    return 0;
  }
}
