import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAGE_LABEL, STAGE_ORDER, type PlateStage } from "@/domain/plates/status";
import { listPlateModels, listPlates } from "@/services/plates.service";
import { PlateList } from "./plate-list";
import { selectClass } from "../_components/field-styles";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function PlacasPage({ searchParams }: { searchParams: Promise<{ q?: string; etapa?: string; modelo?: string; p?: string }> }) {
  const { q, etapa, modelo, p } = await searchParams;
  const stage = STAGE_ORDER.find((s): s is PlateStage => s === etapa);
  const page = Math.max(1, Number(p) || 1);

  const [{ plates, total }, models] = await Promise.all([
    listPlates({ q, stage, modelId: modelo || undefined, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    listPlateModels(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (etapa) params.set("etapa", etapa);
    if (modelo) params.set("modelo", modelo);
    if (target > 1) params.set("p", String(target));
    return `/admin/estoque/placas${params.size ? `?${params}` : ""}`;
  };
  const filtered = Boolean(q || stage || modelo);

  return (
    <div className="space-y-4">
      <form method="GET" className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_10rem_12rem_auto] sm:items-end">
        <div className="space-y-1">
          <label htmlFor="f-q" className="text-xs font-medium">
            Buscar por série, código ou cliente
          </label>
          <Input id="f-q" name="q" defaultValue={q ?? ""} placeholder="Ex.: L001-07, abcd2345 ou Padaria Sol" />
        </div>
        <div className="space-y-1">
          <label htmlFor="f-etapa" className="text-xs font-medium">
            Etapa
          </label>
          <select id="f-etapa" name="etapa" className={selectClass} defaultValue={stage ?? ""}>
            <option value="">Todas</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-modelo" className="text-xs font-medium">
            Modelo
          </label>
          <select id="f-modelo" name="modelo" className={selectClass} defaultValue={modelo ?? ""}>
            <option value="">Todos</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit">
            <Search className="size-4" /> Filtrar
          </Button>
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href="/admin/estoque/placas">Limpar</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <p className="text-sm text-muted-foreground" role="status">
        {total} placa{total === 1 ? "" : "s"}
        {filtered ? " com esses filtros" : " no total"}
        {pages > 1 ? ` · página ${page} de ${pages}` : ""}
      </p>

      <PlateList plates={plates} />

      {pages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={link(page - 1)}>← Anterior</Link>
            </Button>
          ) : (
            <span />
          )}
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={link(page + 1)}>Próxima →</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
