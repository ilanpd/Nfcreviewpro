import { SkeletonGrid, SkeletonText } from "@nfc-os/ui";

/**
 * Estado de carregamento do Admin (C15) — mesmo motivo de
 * `dashboard/loading.tsx`. Mora dentro do route group `(sidebar)` de
 * propósito: assim o esqueleto entra por baixo do layout com a sidebar e
 * nunca cobre `/admin/executivo` (o wallboard, que vive fora do grupo e
 * tem chrome próprio).
 *
 * Achado de auditoria (28/09/2026): mesma lacuna de `dashboard/loading.tsx`
 * — só cobria a entrada no `(sidebar)` em si, não a troca entre
 * empresas/pedidos/financeiro/conteúdo/contato (irmãos). Cada subpágina
 * ganhou seu próprio `loading.tsx`, reexportando este componente.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <div className="skeleton-shimmer h-8 w-64 rounded-md bg-muted" />
        <SkeletonText lines={1} className="max-w-md" />
      </div>
      <SkeletonGrid count={4} />
      <div className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}
