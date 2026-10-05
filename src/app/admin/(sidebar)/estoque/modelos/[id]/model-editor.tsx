"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileText, ImageOff, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { effectiveDpi, pageSizeMm, PT_PER_MM, qrModuleSizeMm, validateLayout, type PlateLayout } from "@/domain/plates/layout";
import { selectClass } from "../../_components/field-styles";

export interface EditorVersion {
  version: number;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  qrXMm: number;
  qrYMm: number;
  qrSizeMm: number;
  qrErrorCorrection: "L" | "M" | "Q" | "H";
  qrDarkColor: string;
  qrLightColor: string;
  serialEnabled: boolean;
  serialXMm: number;
  serialYMm: number;
  serialFontPt: number;
  serialColor: string;
  backgroundWidthPx: number | null;
  backgroundHeightPx: number | null;
  backgroundName: string | null;
}

type Form = Omit<EditorVersion, "version" | "backgroundWidthPx" | "backgroundHeightPx" | "backgroundName">;

const MAX_BACKGROUND_BYTES = 3.5 * 1024 * 1024;
const finite = (v: number) => (Number.isFinite(v) ? v : 0);
const round = (v: number) => Math.round(v * 2) / 2; // passos de 0,5 mm
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function NumberField({ id, label, value, onChange, step = 0.5, suffix = "mm" }: { id: string; label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input id={id} type="number" inputMode="decimal" step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.valueAsNumber)} />
        <span className="w-6 shrink-0 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-8 w-10 cursor-pointer rounded-md border border-input bg-transparent p-0.5" />
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

/**
 * Editor visual do modelo (ADR-092). O que se vê aqui é calculado pela MESMA
 * geometria do PDF (`domain/plates/layout.ts`): arrastar o QR na tela mexe nos
 * mesmos milímetros que o arquivo da gráfica usa. A prévia é aproximada (o QR
 * mostrado é de exemplo) — a "Prova em PDF" é o arquivo real.
 */
export function ModelEditor({
  modelId,
  version,
  qrModulesByEc,
}: {
  modelId: string;
  version: EditorVersion;
  qrModulesByEc: Record<"L" | "M" | "Q" | "H", number>;
}) {
  const router = useRouter();
  const initial: Form = useMemo(
    () => ({
      widthMm: version.widthMm,
      heightMm: version.heightMm,
      bleedMm: version.bleedMm,
      qrXMm: version.qrXMm,
      qrYMm: version.qrYMm,
      qrSizeMm: version.qrSizeMm,
      qrErrorCorrection: version.qrErrorCorrection,
      qrDarkColor: version.qrDarkColor,
      qrLightColor: version.qrLightColor,
      serialEnabled: version.serialEnabled,
      serialXMm: version.serialXMm,
      serialYMm: version.serialYMm,
      serialFontPt: version.serialFontPt,
      serialColor: version.serialColor,
    }),
    [version]
  );
  const [form, setForm] = useState<Form>(initial);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removeArt, setRemoveArt] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileDims, setFileDims] = useState<{ widthPx: number; heightPx: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Prévia da arte recém-escolhida (ainda não salva).
  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      setFileDims(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    const img = new Image();
    img.onload = () => setFileDims({ widthPx: img.naturalWidth, heightPx: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const layout: PlateLayout = useMemo(
    () => ({
      widthMm: finite(form.widthMm),
      heightMm: finite(form.heightMm),
      bleedMm: finite(form.bleedMm),
      qrXMm: finite(form.qrXMm),
      qrYMm: finite(form.qrYMm),
      qrSizeMm: finite(form.qrSizeMm),
      serialEnabled: form.serialEnabled,
      serialXMm: finite(form.serialXMm),
      serialYMm: finite(form.serialYMm),
      serialFontPt: finite(form.serialFontPt),
    }),
    [form]
  );
  const page = pageSizeMm(layout);

  const background = useMemo(
    () => (file ? fileDims : removeArt || !version.backgroundWidthPx ? null : { widthPx: version.backgroundWidthPx, heightPx: version.backgroundHeightPx ?? 0 }),
    [file, fileDims, removeArt, version.backgroundWidthPx, version.backgroundHeightPx]
  );
  const qrModules = qrModulesByEc[form.qrErrorCorrection];
  const check = useMemo(() => validateLayout(layout, { qrModules, background }), [layout, qrModules, background]);
  const moduleMm = qrModuleSizeMm(layout.qrSizeMm, qrModules);
  const dpi = background && page.width > 0 ? Math.round(Math.min(effectiveDpi(background.widthPx, page.width), effectiveDpi(background.heightPx, page.height))) : null;

  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || file !== null || removeArt || note.trim() !== "";
  const bgSrc = fileUrl ?? (!removeArt && version.backgroundWidthPx ? `/api/admin/plates/models/${modelId}/background?v=${version.version}` : null);

  // --- prévia: milímetros -> pixels pela largura real do quadro ---
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pxPerMm, setPxPerMm] = useState(4);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || page.width <= 0) return;
    const observer = new ResizeObserver(([entry]) => setPxPerMm(entry.contentRect.width / page.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [page.width]);

  const drag = useRef<{ target: "qr" | "serial"; startX: number; startY: number; origX: number; origY: number } | null>(null);

  function moveTo(target: "qr" | "serial", x: number, y: number) {
    if (target === "qr") {
      setForm((f) => ({ ...f, qrXMm: clamp(round(x), 0, Math.max(0, finite(f.widthMm) - finite(f.qrSizeMm))), qrYMm: clamp(round(y), 0, Math.max(0, finite(f.heightMm) - finite(f.qrSizeMm))) }));
    } else {
      setForm((f) => ({ ...f, serialXMm: clamp(round(x), 0, finite(f.widthMm)), serialYMm: clamp(round(y), 0, finite(f.heightMm)) }));
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, target: "qr" | "serial") {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { target, startX: e.clientX, startY: e.clientY, origX: target === "qr" ? layout.qrXMm : layout.serialXMm, origY: target === "qr" ? layout.qrYMm : layout.serialYMm };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    moveTo(d.target, d.origX + (e.clientX - d.startX) / pxPerMm, d.origY + (e.clientY - d.startY) / pxPerMm);
  }
  /** Anda a partir do estado MAIS RECENTE (não do que a tela já pintou): setas em repetição rápida não perdem passos. */
  function nudge(target: "qr" | "serial", dx: number, dy: number) {
    setForm((f) => {
      if (target === "qr") {
        return {
          ...f,
          qrXMm: clamp(round(finite(f.qrXMm) + dx), 0, Math.max(0, finite(f.widthMm) - finite(f.qrSizeMm))),
          qrYMm: clamp(round(finite(f.qrYMm) + dy), 0, Math.max(0, finite(f.heightMm) - finite(f.qrSizeMm))),
        };
      }
      return { ...f, serialXMm: clamp(round(finite(f.serialXMm) + dx), 0, finite(f.widthMm)), serialYMm: clamp(round(finite(f.serialYMm) + dy), 0, finite(f.heightMm)) };
    });
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>, target: "qr" | "serial") {
    const step = e.shiftKey ? 5 : 0.5;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = delta[e.key];
    if (!move) return;
    e.preventDefault();
    nudge(target, move[0], move[1]);
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (picked.type !== "image/png" && picked.type !== "image/jpeg") return void toast.error("A arte precisa ser PNG ou JPG.");
    if (picked.size > MAX_BACKGROUND_BYTES) return void toast.error(`A arte tem ${(picked.size / 1024 / 1024).toFixed(1)} MB; o limite é 3,5 MB. Exporte como JPG de qualidade alta.`);
    setFile(picked);
    setRemoveArt(false);
  }

  async function save() {
    setSaving(true);
    try {
      const body = new FormData();
      body.set("layout", JSON.stringify({ ...layout, qrErrorCorrection: form.qrErrorCorrection, qrDarkColor: form.qrDarkColor, qrLightColor: form.qrLightColor, serialColor: form.serialColor, note: note.trim() || undefined, background: file ? "replace" : removeArt ? "remove" : "keep" }));
      if (file) body.set("background", file);
      const res = await fetch(`/api/admin/plates/models/${modelId}/versions`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar");
      setWarnings(data.warnings ?? []);
      toast.success(`Versão ${data.version.version} salva.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  const fontPx = (layout.serialFontPt / PT_PER_MM) * pxPerMm;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div className="space-y-2">
        <div
          ref={wrapRef}
          className="relative w-full touch-none overflow-hidden rounded-lg border bg-white shadow-sm"
          style={{ aspectRatio: `${page.width || 1} / ${page.height || 1}` }}
        >
          {bgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local de uma arte que pode ser um blob: URL; next/image não serve aqui
            <img src={bgSrc} alt="Arte de fundo do modelo" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
          ) : null}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border border-dashed border-fuchsia-500"
            style={{ left: layout.bleedMm * pxPerMm, top: layout.bleedMm * pxPerMm, width: layout.widthMm * pxPerMm, height: layout.heightMm * pxPerMm, boxShadow: "0 0 0 9999px rgba(0,0,0,0.28)" }}
          />
          <div
            role="slider"
            tabIndex={0}
            aria-label="Posição do QR. Arraste ou use as setas do teclado"
            aria-valuetext={`${layout.qrXMm} mm da esquerda, ${layout.qrYMm} mm do topo`}
            aria-valuenow={layout.qrXMm}
            onPointerDown={(e) => onPointerDown(e, "qr")}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onKeyDown={(e) => onKeyDown(e, "qr")}
            className="absolute cursor-move outline-2 outline-offset-0 outline-sky-500 focus-visible:outline-4"
            style={{ left: (layout.bleedMm + layout.qrXMm) * pxPerMm, top: (layout.bleedMm + layout.qrYMm) * pxPerMm, width: layout.qrSizeMm * pxPerMm, height: layout.qrSizeMm * pxPerMm, background: form.qrLightColor }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- QR de exemplo, SVG gerado pela própria API */}
            <img src="/api/qr/exemplo0?format=svg&size=256" alt="" draggable={false} className="pointer-events-none h-full w-full select-none" style={{ mixBlendMode: "multiply" }} />
          </div>
          {form.serialEnabled ? (
            <div
              role="slider"
              tabIndex={0}
              aria-label="Posição da série impressa. Arraste ou use as setas do teclado"
              aria-valuetext={`${layout.serialXMm} mm da esquerda, ${layout.serialYMm} mm do topo`}
              aria-valuenow={layout.serialXMm}
              onPointerDown={(e) => onPointerDown(e, "serial")}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onKeyDown={(e) => onKeyDown(e, "serial")}
              className="absolute cursor-move font-bold leading-none whitespace-nowrap outline-1 outline-dashed outline-sky-500 focus-visible:outline-2"
              style={{ left: (layout.bleedMm + layout.serialXMm) * pxPerMm, top: (layout.bleedMm + layout.serialYMm) * pxPerMm, fontSize: fontPx, color: form.serialColor, fontFamily: "Helvetica, Arial, sans-serif" }}
            >
              L000-00
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Arraste o QR e a série (ou use as setas, com Shift para andar mais rápido). A linha tracejada rosa é o corte; a parte escurecida é a sangria.
          Página do PDF: {page.width} × {page.height} mm.
        </p>
      </div>

      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Tamanho</h3>
          <div className="grid grid-cols-3 gap-3">
            <NumberField id="w" label="Largura" value={form.widthMm} onChange={(v) => set("widthMm", v)} />
            <NumberField id="h" label="Altura" value={form.heightMm} onChange={(v) => set("heightMm", v)} />
            <NumberField id="b" label="Sangria" value={form.bleedMm} onChange={(v) => set("bleedMm", v)} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">QR</h3>
          <div className="grid grid-cols-3 gap-3">
            <NumberField id="qx" label="Da esquerda" value={form.qrXMm} onChange={(v) => set("qrXMm", v)} />
            <NumberField id="qy" label="Do topo" value={form.qrYMm} onChange={(v) => set("qrYMm", v)} />
            <NumberField id="qs" label="Lado" value={form.qrSizeMm} onChange={(v) => set("qrSizeMm", v)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ec" className="text-xs">
                Correção de erros
              </Label>
              <select id="ec" className={selectClass} value={form.qrErrorCorrection} onChange={(e) => set("qrErrorCorrection", e.target.value as Form["qrErrorCorrection"])}>
                <option value="L">L — menor</option>
                <option value="M">M — padrão</option>
                <option value="Q">Q — alta</option>
                <option value="H">H — máxima</option>
              </select>
            </div>
            <ColorField id="qd" label="Módulos" value={form.qrDarkColor} onChange={(v) => set("qrDarkColor", v)} />
            <ColorField id="ql" label="Fundo do QR" value={form.qrLightColor} onChange={(v) => set("qrLightColor", v)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Cada quadradinho do QR sai com <strong>{moduleMm.toFixed(2).replace(".", ",")} mm</strong> (recomendado: pelo menos 0,5 mm). Preto sobre branco é o mais seguro para leitura.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Série impressa</h3>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.serialEnabled} onChange={(e) => set("serialEnabled", e.target.checked)} className="size-4" />
              Imprimir a série na placa
            </label>
          </div>
          {form.serialEnabled ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField id="sx" label="Da esquerda" value={form.serialXMm} onChange={(v) => set("serialXMm", v)} />
              <NumberField id="sy" label="Do topo" value={form.serialYMm} onChange={(v) => set("serialYMm", v)} />
              <NumberField id="sf" label="Corpo" value={form.serialFontPt} step={0.5} suffix="pt" onChange={(v) => set("serialFontPt", v)} />
              <ColorField id="sc" label="Cor" value={form.serialColor} onChange={(v) => set("serialColor", v)} />
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Arte de fundo</h3>
          <p className="text-xs text-muted-foreground">
            PNG ou JPG de até 3,5 MB, <strong>sem o QR</strong> (deixe um painel branco chapado onde ele vai entrar), já no tamanho da página com sangria
            ({page.width} × {page.height} mm; em 300 dpi, {Math.round((page.width / 25.4) * 300)} × {Math.round((page.height / 25.4) * 300)} px).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <label className="cursor-pointer">
                <Upload className="size-3.5" /> {bgSrc ? "Trocar arte" : "Enviar arte"}
                <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={pickFile} />
              </label>
            </Button>
            {bgSrc ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => (setFile(null), setRemoveArt(true))}>
                <ImageOff className="size-3.5" /> Remover arte
              </Button>
            ) : null}
            {file ? (
              <span className="text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(0)} KB) — não salva ainda
              </span>
            ) : version.backgroundName && !removeArt ? (
              <span className="text-xs text-muted-foreground">{version.backgroundName}</span>
            ) : null}
          </div>
          {dpi ? (
            <p className={dpi < 250 ? "text-xs font-medium text-amber-700 dark:text-amber-300" : "text-xs text-muted-foreground"}>Resolução neste tamanho: ~{dpi} dpi.</p>
          ) : null}
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="note" className="text-sm font-semibold">
            O que mudou nesta versão (opcional)
          </Label>
          <Input id="note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: QR maior e arte nova do rodapé" />
        </section>

        {check.errors.length > 0 ? (
          <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {check.errors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
        {check.warnings.length > 0 || warnings.length > 0 ? (
          <div role="status" className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-4" aria-hidden="true" /> Atenção antes de imprimir
            </p>
            {[...new Set([...check.warnings, ...warnings])].map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={saving || !dirty || check.errors.length > 0}>
            <Save className="size-4" /> {saving ? "Salvando…" : `Salvar como versão ${version.version + 1}`}
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/admin/plates/models/${modelId}/proof?v=${version.version}`} target="_blank" rel="noopener">
              <FileText className="size-4" /> Prova em PDF (v{version.version} salva)
            </a>
          </Button>
          {dirty ? <span className="text-xs text-muted-foreground">Há mudanças não salvas.</span> : null}
        </div>
      </div>
    </div>
  );
}
