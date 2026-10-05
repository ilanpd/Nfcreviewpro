import { cn } from "@/lib/utils";
import { STAGE_LABEL, STAGE_TONE, type PlateStage, type PlateTone } from "@/domain/plates/status";

/**
 * Estoque de placas (ADR-092) — o selo de cada etapa, igual em todas as telas do
 * módulo. A cor sempre vem acompanhada do texto (nunca só cor), e o texto vem
 * de `domain/plates/status.ts`, a mesma fonte do resto do produto.
 */
const TONE_CLASS: Record<PlateTone, string> = {
  muted: "bg-muted text-muted-foreground",
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  brand: "bg-brand-subtle text-brand-ink",
  danger: "bg-destructive/10 text-destructive",
};

export function StageBadge({ stage, className }: { stage: PlateStage; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", TONE_CLASS[STAGE_TONE[stage]], className)}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

export type BatchStageValue = "GENERATED" | "AT_SUPPLIER" | "RECEIVED" | "VERIFIED";

const BATCH_LABEL: Record<BatchStageValue, { label: string; tone: PlateTone }> = {
  GENERATED: { label: "Gerado", tone: "muted" },
  AT_SUPPLIER: { label: "Na gráfica", tone: "info" },
  RECEIVED: { label: "Recebido, conferindo", tone: "brand" },
  VERIFIED: { label: "Tudo conferido", tone: "success" },
};

export function BatchStageBadge({ stage, className }: { stage: BatchStageValue; className?: string }) {
  const { label, tone } = BATCH_LABEL[stage];
  return <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", TONE_CLASS[tone], className)}>{label}</span>;
}
