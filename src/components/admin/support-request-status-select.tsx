"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupportRequestStatus } from "@/generated/prisma/client";

const STATUS_LABEL: Record<SupportRequestStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
};

/** Central de Suporte (Fase 20), lado Admin — troca o status de um chamado
 * inline, mesmo padrão otimista de `feedback-list.tsx::toggleResolved`. */
export function SupportRequestStatusSelect({ id, status }: { id: string; status: SupportRequestStatus }) {
  const [current, setCurrent] = useState(status);

  async function handleChange(next: SupportRequestStatus) {
    const previous = current;
    setCurrent(next);
    try {
      const res = await fetch(`/api/admin/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Não foi possível atualizar o status");
      setCurrent(previous);
    }
  }

  return (
    <Select value={current} onValueChange={(v) => handleChange(v as SupportRequestStatus)}>
      <SelectTrigger className="h-8 w-36 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATUS_LABEL) as SupportRequestStatus[]).map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
