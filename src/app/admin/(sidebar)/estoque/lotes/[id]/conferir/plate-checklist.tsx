"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlateRowDTO } from "@/services/plates.service";
import { ReasonDialog } from "../../../_components/plate-detail-sheet";
import { StageBadge } from "../../../_components/stage-badge";

type CheckKey = "nfcChecked" | "qrChecked" | "serialChecked";

const CHECKS: { key: CheckKey; label: string; hint: string }[] = [
  { key: "nfcChecked", label: "NFC", hint: "Encoste o celular" },
  { key: "qrChecked", label: "QR", hint: "Escaneie" },
  { key: "serialChecked", label: "Série", hint: "Bate com a impressa?" },
];

async function patch(id: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/admin/plates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  return (await res.json().catch(() => ({}))).error ?? "Não foi possível salvar";
}

/**
 * Conferência na chegada, feita para o celular na mão de quem está com as
 * placas. Para cada uma: encosta o celular (o NFC abre a página com a série),
 * escaneia o QR (tem que mostrar a MESMA série) e compara com o número impresso.
 * As três marcas viram "conferida"; uma placa com problema vai para defeituosa.
 */
export function PlateChecklist({ plates }: { plates: PlateRowDTO[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(plates);
  const [onlyPending, setOnlyPending] = useState(false);
  const [defectiveFor, setDefectiveFor] = useState<PlateRowDTO | null>(null);

  // Sempre que o servidor manda dados novos (ex.: toques contados), eles valem.
  useEffect(() => setRows(plates), [plates]);

  // Enquanto a tela está aberta, atualiza sozinha para mostrar os toques recebidos.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 8000);
    return () => clearInterval(timer);
  }, [router]);

  const active = rows.filter((r) => r.stage !== "VOIDED");
  const verified = active.filter((r) => r.status === "VERIFIED").length;
  const defective = active.filter((r) => r.status === "DEFECTIVE").length;
  const total = active.length;
  const visible = useMemo(() => (onlyPending ? rows.filter((r) => r.status === "GENERATED" || r.status === "IN_PRODUCTION") : rows), [rows, onlyPending]);

  function applyChecks(id: string, checks: Partial<Record<CheckKey, boolean>>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...checks };
        const all = next.nfcChecked && next.qrChecked && next.serialChecked;
        const status = r.status === "DEFECTIVE" || r.status === "VOIDED" ? r.status : all ? "VERIFIED" : "IN_PRODUCTION";
        return { ...next, status, stage: status === "VERIFIED" ? (r.card ? "ASSIGNED" : "IN_STOCK") : status === "IN_PRODUCTION" ? "IN_PRODUCTION" : r.stage };
      })
    );
  }

  async function setChecks(plate: PlateRowDTO, checks: Partial<Record<CheckKey, boolean>>) {
    const before = Object.fromEntries(Object.keys(checks).map((k) => [k, plate[k as CheckKey]])) as Partial<Record<CheckKey, boolean>>;
    applyChecks(plate.id, checks); // otimista: o toque responde na hora
    const error = await patch(plate.id, { action: "check", ...checks });
    if (error) {
      applyChecks(plate.id, before);
      toast.error(error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 -mx-4 space-y-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium tabular-nums">
            {verified} de {total} conferidas
            {defective > 0 ? <span className="text-amber-700 dark:text-amber-300"> · {defective} com defeito</span> : null}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" className="size-4" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
              Só pendentes
            </label>
            <Button type="button" variant="ghost" size="icon" aria-label="Atualizar agora" onClick={() => router.refresh()}>
              <RefreshCw className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div role="progressbar" aria-valuenow={verified} aria-valuemin={0} aria-valuemax={total} aria-label="Placas conferidas" className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${total ? (verified / total) * 100 : 0}%` }} />
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((plate) => {
          const done = plate.status === "VERIFIED";
          const retired = plate.status === "DEFECTIVE" || plate.status === "VOIDED";
          return (
            <li key={plate.id} className={cn("rounded-xl border p-4 transition-colors", done && "border-emerald-500/50 bg-emerald-500/5", retired && "opacity-70")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-2xl font-semibold tracking-wide">{plate.serial}</span>
                <StageBadge stage={plate.stage} />
              </div>
              {retired ? (
                <p className="mt-3 text-sm text-muted-foreground">{plate.defectReason ?? "Fora de uso."} Restaure pelo detalhe da placa se foi engano.</p>
              ) : (
                <>
                  <div role="group" aria-label={`Conferência da placa ${plate.serial}`} className="mt-3 grid grid-cols-3 gap-2">
                    {CHECKS.map((check) => {
                      const on = plate[check.key];
                      return (
                        <button
                          key={check.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setChecks(plate, { [check.key]: !on })}
                          className={cn(
                            "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-center transition-colors",
                            on ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "hover:bg-muted"
                          )}
                        >
                          <span className="flex items-center gap-1 text-sm font-semibold">
                            {on ? <Check className="size-4" aria-hidden="true" /> : null}
                            {check.label}
                          </span>
                          <span className="text-[11px] leading-tight text-muted-foreground">{check.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {!done ? (
                      <Button type="button" size="sm" onClick={() => setChecks(plate, { nfcChecked: true, qrChecked: true, serialChecked: true })}>
                        <CheckCheck className="size-4" /> Tudo ok
                      </Button>
                    ) : null}
                    {!plate.card ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setDefectiveFor(plate)}>
                        Defeituosa
                      </Button>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {plate.scanCount > 0 ? `${plate.scanCount} toque${plate.scanCount === 1 ? "" : "s"} recebido${plate.scanCount === 1 ? "" : "s"}` : done ? "" : "nenhum toque ainda"}
                    </span>
                  </div>
                </>
              )}
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {onlyPending ? "Nenhuma placa pendente. O lote está todo conferido." : "Este lote não tem placas."}
          </li>
        ) : null}
      </ul>

      <ReasonDialog
        open={defectiveFor !== null}
        onOpenChange={(open) => !open && setDefectiveFor(null)}
        title={`Placa ${defectiveFor?.serial ?? ""} com defeito`}
        description="Ela sai do estoque e não pode ser vendida. Dá para restaurar depois, se foi engano."
        confirmLabel="Marcar defeituosa"
        onConfirm={async (reason) => {
          if (!defectiveFor) return;
          const error = await patch(defectiveFor.id, { action: "defective", reason });
          if (error) {
            toast.error(error);
            throw new Error(error);
          }
          toast.success(`Placa ${defectiveFor.serial} marcada como defeituosa.`);
          router.refresh();
        }}
      />
    </div>
  );
}
