import { AlertTriangle, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AccessNotice } from "@/domain/billing/gate";

/** Aviso do topo do painel quando a assinatura está atrasada ou inativa (ADR-079). */
export function AccessBanner({ notice }: { notice: AccessNotice }) {
  const Icon = notice.tone === "critical" ? Lock : AlertTriangle;
  return (
    <Alert variant={notice.tone === "critical" ? "destructive" : "default"} role="status">
      <Icon />
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription>
        {notice.description}{" "}
        <a href="/dashboard/settings" className="font-medium underline underline-offset-4">
          Gerenciar assinatura
        </a>
      </AlertDescription>
    </Alert>
  );
}
