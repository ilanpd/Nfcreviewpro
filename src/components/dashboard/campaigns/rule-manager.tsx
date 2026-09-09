"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calendar, Clock, Plus, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RuleType } from "@/generated/prisma/client";

const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEVICE_LABEL: Record<string, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Computador" };

const RULE_TYPE_LABEL: Record<RuleType, string> = {
  DAY_OF_WEEK: "Dia da semana",
  TIME_WINDOW: "Horário",
  DATE_RANGE: "Período de datas",
  DEVICE_TYPE: "Dispositivo",
};

const RULE_TYPE_ICON: Record<RuleType, typeof Clock> = {
  DAY_OF_WEEK: Calendar,
  TIME_WINDOW: Clock,
  DATE_RANGE: Calendar,
  DEVICE_TYPE: Smartphone,
};

interface RuleItem {
  id: string;
  type: RuleType;
  config: unknown;
}

function summarizeRule(type: RuleType, config: unknown): string {
  const c = (config ?? {}) as Record<string, unknown>;
  if (type === "DAY_OF_WEEK" && Array.isArray(c.days)) {
    return (c.days as number[]).map((d) => WEEKDAY_LABEL[d]).join(", ");
  }
  if (type === "TIME_WINDOW") return `${c.startTime ?? "?"} – ${c.endTime ?? "?"}`;
  if (type === "DATE_RANGE") return `${c.startDate ?? "?"} a ${c.endDate ?? "?"}`;
  if (type === "DEVICE_TYPE" && Array.isArray(c.devices)) {
    return (c.devices as string[]).map((d) => DEVICE_LABEL[d] ?? d).join(", ");
  }
  return "—";
}

interface RuleManagerProps {
  campaignId: string;
  initialRules: RuleItem[];
  canManage: boolean;
}

export function RuleManager({ campaignId, initialRules, canManage }: RuleManagerProps) {
  const [rules, setRules] = useState(initialRules);
  const [type, setType] = useState<RuleType>("DAY_OF_WEEK");
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("22:00");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [devices, setDevices] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function toggleDevice(device: string) {
    setDevices((prev) => (prev.includes(device) ? prev.filter((d) => d !== device) : [...prev, device]));
  }

  function currentConfig(): Record<string, unknown> {
    if (type === "DAY_OF_WEEK") return { days };
    if (type === "TIME_WINDOW") return { startTime, endTime };
    if (type === "DATE_RANGE") return { startDate, endDate };
    return { devices };
  }

  async function handleAdd() {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, config: currentConfig() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível criar a regra");
      }
      const { rule } = await res.json();
      setRules((prev) => [...prev, rule]);
      toast.success("Regra adicionada");
      setDays([]);
      setDevices([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(ruleId: string) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/rules/${ruleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast.success("Regra removida");
    } catch {
      toast.error("Não foi possível remover a regra");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Todas as regras precisam ser verdadeiras ao mesmo tempo para a campanha valer (E, não OU). Sem regras, a
        campanha vale sempre que sua janela de início/término permitir.
      </p>

      {rules.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma regra — a campanha vale o tempo todo (dentro da janela de início/término, se houver).
        </p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => {
            const Icon = RULE_TYPE_ICON[rule.type];
            return (
              <li key={rule.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    <span className="text-muted-foreground">{RULE_TYPE_LABEL[rule.type]}:</span>{" "}
                    {summarizeRule(rule.type, rule.config)}
                  </span>
                </div>
                {canManage ? (
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => handleRemove(rule.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">Nova regra</p>
          <Select value={type} onValueChange={(v: RuleType) => setType(v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RULE_TYPE_LABEL) as RuleType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {RULE_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {type === "DAY_OF_WEEK" ? (
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABEL.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    days.includes(day) ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {type === "TIME_WINDOW" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          ) : null}

          {type === "DATE_RANGE" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          ) : null}

          {type === "DEVICE_TYPE" ? (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(DEVICE_LABEL).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDevice(value)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    devices.includes(value) ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <Button size="sm" onClick={handleAdd} disabled={saving} className="w-full">
            <Plus className="size-3.5" /> Adicionar regra
          </Button>
        </div>
      ) : null}
    </div>
  );
}
