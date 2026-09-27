"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { slideUp, staggerContainer } from "@nfc-os/animations";
import { PremiumCardShell } from "./premium-card";

export type InsightSeverity = "positive" | "neutral" | "attention";

const SEVERITY_COLOR: Record<InsightSeverity, string> = {
  positive: "#22C55E",
  neutral: "#6366F1",
  attention: "#F59E0B",
};

export interface InsightCardEntry {
  id: string;
  message: string;
  severity: InsightSeverity;
  /** Fase 19.2 — Radar de Atenção do Admin: quando presente, o card inteiro
   * vira um link pra tela que resolve aquele insight (Explainability First
   * também significa nunca deixar "o que fazer com isso" só implícito).
   * Opcional e aditivo — nenhum uso existente (Command Center, Analytics
   * Enterprise) precisa mudar. */
  href?: string;
}

/**
 * Insight Automático (Fase 7) — uma frase gerada pelo Insights Engine a
 * partir de dados reais (nunca fixa), com uma barra de acento colorida por
 * severidade em vez de um ícone de "IA" genérico — o produto não finge ser
 * um chatbot, é um número traduzido em português. Ver domain/analytics/insights.ts.
 */
export function InsightCardList({ insights, emptyLabel = "Nenhum insight com significância suficiente neste período ainda." }: { insights: InsightCardEntry[]; emptyLabel?: string }) {
  if (insights.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-3 sm:grid-cols-2">
      {insights.map((insight) => (
        <motion.div key={insight.id} variants={slideUp}>
          <PremiumCardShell accentColor={SEVERITY_COLOR[insight.severity]} className="p-4" interactive={!!insight.href}>
            {insight.href ? (
              <Link href={insight.href} className="flex items-center justify-between gap-2">
                <p className="text-sm text-foreground">{insight.message}</p>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ) : (
              <p className="text-sm text-foreground">{insight.message}</p>
            )}
          </PremiumCardShell>
        </motion.div>
      ))}
    </motion.div>
  );
}
