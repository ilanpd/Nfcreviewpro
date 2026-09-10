"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EndpointParam {
  name: string;
  label: string;
  type: "number" | "select";
  placeholder?: string;
  options?: string[];
  default?: string;
}

interface Endpoint {
  id: string;
  label: string;
  path: string;
  params: EndpointParam[];
}

const ENDPOINTS: Endpoint[] = [
  { id: "cards", label: "Listar cartões", path: "/cards", params: [{ name: "limit", label: "Limite", type: "number", placeholder: "20" }] },
  { id: "campaigns", label: "Listar campanhas", path: "/campaigns", params: [{ name: "limit", label: "Limite", type: "number", placeholder: "20" }] },
  { id: "zones", label: "Listar zonas", path: "/zones", params: [] },
  { id: "branches", label: "Listar unidades", path: "/branches", params: [] },
  { id: "organizations", label: "Ver organização", path: "/organizations", params: [] },
  { id: "kpis", label: "KPIs executivos", path: "/analytics/kpis", params: [{ name: "days", label: "Dias", type: "number", placeholder: "30" }] },
  { id: "funnel", label: "Funil de conversão", path: "/analytics/funnel", params: [{ name: "days", label: "Dias", type: "number", placeholder: "30" }] },
  {
    id: "rankings",
    label: "Rankings",
    path: "/analytics/rankings",
    params: [
      { name: "type", label: "Tipo", type: "select", options: ["CAMPAIGN", "ZONE", "CARD", "EMPLOYEE", "HOUR", "DAY_OF_WEEK"], default: "ZONE" },
      { name: "days", label: "Dias", type: "number", placeholder: "30" },
    ],
  },
  { id: "events", label: "Eventos recentes", path: "/events", params: [{ name: "limit", label: "Limite", type: "number", placeholder: "20" }] },
  { id: "feedback", label: "Feedbacks privados", path: "/feedback", params: [] },
];

/**
 * Explorador de API ao vivo (Fase 9) — chama `/api/v1/**` de verdade, do
 * navegador, com a chave de demonstração somente-leitura (ver
 * `domain/api-v1/demo-key.ts`). Nunca uma resposta fabricada: o
 * desenvolvedor vê exatamente o que a API pública responde, contra a
 * empresa de demonstração Bella Vista — a mesma API, o mesmo contrato, que
 * uma integração real usaria.
 */
export function ApiExplorer({ demoApiKey }: { demoApiKey: string }) {
  const [endpointId, setEndpointId] = useState(ENDPOINTS[0].id);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: number; requestId: string | null; body: unknown } | null>(null);

  const endpoint = ENDPOINTS.find((e) => e.id === endpointId)!;

  function buildQuery(): string {
    const entries = endpoint.params
      .map((p): [string, string] => [p.name, paramValues[p.name] || p.default || ""])
      .filter(([, v]) => v !== "");
    if (entries.length === 0) return "";
    return `?${new URLSearchParams(entries).toString()}`;
  }

  const fullPath = `/api/v1${endpoint.path}${buildQuery()}`;
  const curlSnippet = `curl "https://sua-empresa.nfcos.app${fullPath}" \\\n  -H "Authorization: Bearer ${demoApiKey}"`;

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(fullPath, { headers: { Authorization: `Bearer ${demoApiKey}` } });
      const body = await res.json().catch(() => null);
      setResult({ status: res.status, requestId: res.headers.get("x-request-id"), body });
    } catch (err) {
      setResult({ status: 0, requestId: null, body: { error: { message: err instanceof Error ? err.message : "Falha de rede" } } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label>Endpoint</Label>
          <Select
            value={endpointId}
            onValueChange={(v) => {
              setEndpointId(v);
              setParamValues({});
              setResult(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENDPOINTS.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  GET {e.path} — {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {endpoint.params.map((param) =>
          param.type === "select" ? (
            <div key={param.name} className="space-y-1.5">
              <Label>{param.label}</Label>
              <Select
                value={paramValues[param.name] || param.default}
                onValueChange={(v) => setParamValues((prev) => ({ ...prev, [param.name]: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {param.options!.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div key={param.name} className="space-y-1.5">
              <Label>{param.label}</Label>
              <Input
                type="number"
                placeholder={param.placeholder}
                value={paramValues[param.name] || ""}
                onChange={(e) => setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))}
              />
            </div>
          )
        )}

        <pre className="overflow-x-auto rounded-lg bg-neutral-950 p-3 text-xs text-neutral-100">{curlSnippet}</pre>

        <Button onClick={run} disabled={loading} className="w-full">
          {loading ? <Spinner className="size-4" /> : <Play className="size-4" />}
          Executar contra a Bella Vista (dados de demonstração)
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Resposta</p>
        {result ? (
          <>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${
                  result.status >= 200 && result.status < 300
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-500/12 text-red-700 dark:text-red-400"
                }`}
              >
                {result.status || "erro"}
              </span>
              {result.requestId && <span>request_id: {result.requestId}</span>}
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-neutral-950 p-3 text-xs text-neutral-100">
              {JSON.stringify(result.body, null, 2)}
            </pre>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Clique em &ldquo;Executar&rdquo; para ver uma resposta real aqui.</p>
        )}
      </div>
    </div>
  );
}
