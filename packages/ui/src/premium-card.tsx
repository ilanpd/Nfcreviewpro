"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "cn";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { hoverLift } from "@nfc-os/animations";

// Ícones são recebidos como ReactNode já renderizado (`<Icon className="size-4" />`),
// nunca como a referência do componente (`icon={Icon}`) — muitas telas deste
// produto buscam dados em Server Components, e passar uma referência de
// componente (função) como prop para um módulo "use client" quebra a
// serialização do React Server Components ("Functions cannot be passed
// directly to Client Components"). Um elemento JSX já renderizado é
// serializável nesse limite; a função em si não é. Ver ADR-024.

/**
 * Base de todo card premium do NFC OS Design Language — uma única superfície
 * visual (borda, radius, sombra, hover) reaproveitada por KpiCard,
 * AnalyticsCard, CampaignCard, ZoneCard, TableCard e OrganizationCard, em
 * vez de cada um reimplementar seu próprio "container bonito". Ver
 * MANIFESTO_DO_DESIGN.md — "consistência antes de originalidade por card".
 */
export function PremiumCardShell({
  children,
  className,
  accentColor,
  interactive = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  /** Uma barra de destaque de 3px no topo do card — usada para status de
   * campanha/zona/mesa. Omitir para cards neutros (KPI, Analytics). */
  accentColor?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial="rest"
      whileHover={interactive ? "hover" : undefined}
      variants={interactive ? hoverLift : undefined}
      onClick={onClick}
      className={cn(
        "group/premium-card relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-subtle",
        interactive && "cursor-pointer",
        className
      )}
    >
      {accentColor ? (
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accentColor }} aria-hidden />
      ) : null}
      {children}
    </motion.div>
  );
}

// --- Card KPI ---

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  /** Variação percentual — positivo/negativo decide cor e seta automaticamente. */
  delta?: number;
  deltaLabel?: string;
  /** Legenda neutra abaixo do valor, sem cor — para contexto sem indicar uma tendência. */
  hint?: string;
  /** Sobrepõe a cor do valor com uma classe estática (ex.: destacar uma
   * métrica como positiva sem precisar de um `delta` numérico). */
  valueClassName?: string;
  className?: string;
}

export function KpiCard({ label, value, icon, delta, deltaLabel, hint, valueClassName, className }: KpiCardProps) {
  const isPositive = delta !== undefined && delta >= 0;
  return (
    <PremiumCardShell className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>
      {/* `key={value}` força uma troca de elemento a cada mudança de valor —
          um número que muda sozinho é fácil de não perceber (ver Fase 6:
          "toda animação comunica estado"); este pop rápido é o que torna um
          KPI ao vivo (Command Center) visivelmente diferente de um estático. */}
      <AnimatePresence mode="popLayout">
        <motion.p
          key={String(value)}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18 }}
          className={cn("mt-3 text-3xl font-semibold tracking-tight text-foreground", valueClassName)}
        >
          {value}
        </motion.p>
      </AnimatePresence>
      {delta !== undefined ? (
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-xs font-medium",
            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {isPositive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {Math.abs(delta).toFixed(1)}% {deltaLabel}
        </p>
      ) : hint ? (
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </PremiumCardShell>
  );
}

// --- Card Analytics ---

interface AnalyticsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function AnalyticsCard({ title, description, children, action, className }: AnalyticsCardProps) {
  return (
    <PremiumCardShell className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </PremiumCardShell>
  );
}

// --- Card Campanha ---

interface CampaignCardProps {
  name: string;
  description?: string | null;
  typeLabel: string;
  statusColor: string;
  statusLabel: string;
  icon: React.ReactNode;
  metrics?: { label: string; value: string | number }[];
  onClick?: () => void;
  className?: string;
}

export function CampaignCard({
  name,
  description,
  typeLabel,
  statusColor,
  statusLabel,
  icon,
  metrics,
  onClick,
  className,
}: CampaignCardProps) {
  return (
    <PremiumCardShell accentColor={statusColor} interactive={!!onClick} onClick={onClick} className={cn("p-5", className)}>
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5"
          style={{ backgroundColor: `${statusColor}1A`, color: statusColor }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: `${statusColor}1A`, color: statusColor }}
        >
          {statusLabel}
        </span>
      </div>
      {description ? <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{description}</p> : null}
      {metrics && metrics.length > 0 ? (
        <div className="mt-4 flex gap-4 border-t border-border/60 pt-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <p className="text-sm font-semibold text-foreground">{m.value}</p>
              <p className="text-[11px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </PremiumCardShell>
  );
}

// --- Card Zona ---

interface ZoneCardProps {
  name: string;
  branchName?: string | null;
  tableCount: number;
  activeCampaignCount: number;
  onClick?: () => void;
  className?: string;
}

export function ZoneCard({ name, branchName, tableCount, activeCampaignCount, onClick, className }: ZoneCardProps) {
  return (
    <PremiumCardShell interactive={!!onClick} onClick={onClick} className={cn("p-5", className)}>
      <p className="text-sm font-semibold text-foreground">{name}</p>
      {branchName ? <p className="text-xs text-muted-foreground">{branchName}</p> : null}
      <div className="mt-4 flex gap-4 border-t border-border/60 pt-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{tableCount}</p>
          <p className="text-[11px] text-muted-foreground">mesas</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{activeCampaignCount}</p>
          <p className="text-[11px] text-muted-foreground">campanhas ativas</p>
        </div>
      </div>
    </PremiumCardShell>
  );
}

// --- Card Mesa ---

interface TableCardProps {
  name: string;
  seats: number;
  statusColor?: string | null;
  statusLabel?: string | null;
  hasConflict?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TableCard({ name, seats, statusColor, statusLabel, hasConflict, onClick, className }: TableCardProps) {
  return (
    <PremiumCardShell
      accentColor={statusColor ?? undefined}
      interactive={!!onClick}
      onClick={onClick}
      className={cn("p-4", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        {hasConflict ? <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">conflito</span> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{seats} lugares</p>
      {statusLabel ? (
        <p className="mt-2 truncate text-[11px] font-medium" style={{ color: statusColor ?? undefined }}>
          {statusLabel}
        </p>
      ) : null}
    </PremiumCardShell>
  );
}

// --- Card Organização ---

interface OrganizationCardBrandProps {
  name: string;
  companyCount: number;
  currentCompanyName?: string;
  className?: string;
}

export function OrganizationBrandCard({ name, companyCount, currentCompanyName, className }: OrganizationCardBrandProps) {
  return (
    <PremiumCardShell className={cn("overflow-hidden", className)}>
      <div
        className="h-16 w-full"
        style={{ background: "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklch, var(--brand) 60%, var(--chart-2)) 100%)" }}
      />
      <div className="-mt-8 px-5 pb-5">
        <div className="flex size-14 items-center justify-center rounded-2xl border-4 border-card bg-brand text-lg font-semibold text-brand-foreground shadow-elevated">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">
          {companyCount} {companyCount === 1 ? "empresa" : "empresas"}
          {currentCompanyName ? ` · você está em ${currentCompanyName}` : ""}
        </p>
      </div>
    </PremiumCardShell>
  );
}
