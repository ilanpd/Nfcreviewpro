"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Confirmação de ação destrutiva, num Dialog de verdade — não o
 * `window.confirm()` nativo do navegador (sem estilo, inconsistente entre
 * navegadores/SO, e o único ponto do produto ainda fora do design system).
 * `unidades/branch-zone-manager.tsx` já tinha resolvido isto localmente
 * (Auditoria Nível Bilionário, 11/09/2026) só pra excluir unidade/zona;
 * achado de auditoria (28/09/2026): `campaign-row.tsx`, `card-item.tsx`,
 * `table-map-view.tsx` e `team-view.tsx` continuavam com `confirm()` cru —
 * extraído aqui pra ser a única implementação, não uma quinta cópia do
 * mesmo Dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Excluir",
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
