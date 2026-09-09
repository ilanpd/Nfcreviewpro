"use client";

import { Rewind, Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface TimeMachineSummary {
  totalTouches: number;
  topTables: { cardId: string; cardName: string; conversions: number }[];
}

interface TimeMachinePanelProps {
  /** Minutos no passado em relação a agora; `null` = Time Machine desligado. */
  minutesAgo: number | null;
  onMinutesAgoChange: (minutes: number | null) => void;
  summary: TimeMachineSummary | null;
  loading: boolean;
  playing: boolean;
  playbackProgress: number;
  onPlay: () => void;
  onStopPlayback: () => void;
}

const MAX_MINUTES_AGO = 24 * 60;

function formatAt(minutesAgo: number): string {
  const at = new Date(Date.now() - minutesAgo * 60_000);
  return at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Time Machine (Fase 6): volta o Mapa de Mesas no tempo, com base no
 * histórico real de `RedirectLog` (ver `time-machine.service.ts` para o que
 * exatamente é reconstruído e o limite honesto disso). O modo Playback mora
 * aqui também — "reproduzir" é só uma forma automática de percorrer essa
 * mesma linha do tempo, disparando os eventos reais em vez de mover o
 * slider manualmente.
 */
export function TimeMachinePanel({
  minutesAgo,
  onMinutesAgoChange,
  summary,
  loading,
  playing,
  playbackProgress,
  onPlay,
  onStopPlayback,
}: TimeMachinePanelProps) {
  const active = minutesAgo !== null;

  return (
    <Popover onOpenChange={(open) => !open && !active && onMinutesAgoChange(null)}>
      <PopoverTrigger asChild>
        <Button variant={active ? "default" : "outline"} size="sm">
          <Rewind className="size-3.5" /> Time Machine
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              {active ? `Vendo o salão às ${formatAt(minutesAgo)}` : "Agora (ao vivo)"}
            </Label>
            {loading ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
          </div>
          <input
            type="range"
            min={0}
            max={MAX_MINUTES_AGO}
            step={5}
            value={minutesAgo ?? 0}
            onChange={(e) => onMinutesAgoChange(Number(e.target.value) === 0 ? null : Number(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Agora</span>
            <span>24h atrás</span>
          </div>
        </div>

        {active && summary ? (
          <div className="space-y-1.5 rounded-md bg-muted/60 px-3 py-2 text-xs">
            <p>
              <strong>{summary.totalTouches}</strong> toque(s) nos 30 min antes desse momento
            </p>
            {summary.topTables.length > 0 ? (
              <ul className="space-y-0.5 text-muted-foreground">
                {summary.topTables.map((t) => (
                  <li key={t.cardId}>
                    {t.cardName} — {t.conversions} conversão(ões)
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t pt-3">
          {playing ? (
            <Button variant="outline" size="sm" onClick={onStopPlayback} className="flex-1">
              <Square className="size-3.5" /> Parar reprodução ({Math.round(playbackProgress * 100)}%)
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onPlay} className="flex-1">
              <Play className="size-3.5" /> Reproduzir últimos 30 min
            </Button>
          )}
          {active ? (
            <Button variant="ghost" size="sm" onClick={() => onMinutesAgoChange(null)}>
              Voltar ao agora
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
