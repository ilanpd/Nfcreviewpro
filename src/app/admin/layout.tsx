import { notFound } from "next/navigation";
import { isSuperAdmin } from "@/lib/super-admin";

// Achado real do build da Fase 19.1 (não uma suposição): sem isto, o Next
// classificava `/admin`, `/admin/pedidos` e `/admin/conteudo` como
// estáticos (nenhum usa `searchParams`/segmento dinâmico) e os
// pré-renderia UMA VEZ no build — o gate `isSuperAdmin()` abaixo rodaria
// só nesse momento, nunca por requisição real, e todo KPI ficaria
// congelado na data do deploy. Mesmo padrão já usado em `/demo` e
// `dashboard/table-map` para o mesmo problema. `force-dynamic` no layout
// cascateia para toda página em `/admin/**`, então não precisa repetir em
// cada uma.
export const dynamic = "force-dynamic";

/**
 * Painel Admin (Fase 16, gate reativado na Fase 19.1) — separado por
 * completo de `/dashboard` (nunca o mesmo layout, nunca a mesma sidebar):
 * isto é a operação do dono da marca sobre o SITE inteiro, não uma empresa
 * cliente.
 *
 * Fase 19.8 — este layout ficou deliberadamente mínimo: só o gate
 * `isSuperAdmin()`, aplicado a TODA rota em `/admin/**` (Centro de
 * Operações, Pedidos, Empresas, Conteúdo, Financeiro E o Modo Executivo).
 * O chrome de sidebar/header que existia aqui virou `admin/(sidebar)/layout.tsx`
 * — um route group do Next.js (não afeta a URL) que envolve todas as
 * páginas normais, mas deliberadamente NÃO envolve `admin/executivo`, que
 * fica de fora dele para ser full-bleed (wallboard, ver ADR correspondente).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSuperAdmin())) notFound();
  return children;
}
