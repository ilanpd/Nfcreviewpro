import { ArrowRight, Check } from "lucide-react";
import { UPGRADE_PITCH_HEADLINE, getUpgradePitchFeatures } from "@/lib/upgrade-pitch";
import { cn } from "@/lib/utils";

/**
 * Fase 21 — mesmo bloco visual e mesmo texto (`upgrade-pitch.ts`) em todo
 * lugar que oferece assinar o NFC OS pra um convidado (`GUEST`, sem plano):
 * `/loja/sucesso` e `meu-cartao-form.tsx` (retrofit). Estilo reaproveitado
 * de `meu-cartao-form.tsx`, o mais testado em produção até aqui.
 */
export function UpgradePitchCard({ href, className }: { href: string; className?: string }) {
  const features = getUpgradePitchFeatures();

  return (
    <div className={cn("rounded-xl border border-dashed border-brand/40 bg-brand-subtle/40 p-4", className)}>
      <p className="text-sm font-medium text-foreground">{UPGRADE_PITCH_HEADLINE}</p>
      <ul className="mt-3 space-y-1.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
            {feature}
          </li>
        ))}
      </ul>
      <a href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        Assine o NFC OS <ArrowRight className="size-3.5" />
      </a>
    </div>
  );
}
