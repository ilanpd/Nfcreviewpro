import { SkeletonGrid, SkeletonText } from "@nfc-os/ui";

/**
 * Estado de carregamento do Dashboard (C15) — nenhuma rota do produto tinha
 * `loading.tsx`: trocar de página no painel (todas `force-dynamic`, com
 * consulta ao banco) deixava a tela anterior parada, sem nenhum retorno,
 * até os dados chegarem — na rede móvel isso parece travamento. Este
 * fallback entra assim que a navegação começa e mantém o layout (sidebar e
 * header) no lugar; só a área de conteúdo vira esqueleto.
 */
export default function DashboardLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <div className="skeleton-shimmer h-8 w-56 rounded-md bg-muted" />
        <SkeletonText lines={1} className="max-w-md" />
      </div>
      <SkeletonGrid count={4} />
      <div className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}
