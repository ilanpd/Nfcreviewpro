"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * "Nenhum modal sem motivo" (ver MANIFESTO_DO_DESIGN.md) — estes wrappers
 * não reimplementam Dialog/Sheet/Popover (o shadcn/ui continua sendo a base
 * oficial, nunca substituída), só impõem um padrão único de cabeçalho
 * (ícone + título + descrição) e um tamanho consistente, para que todo
 * modal/drawer/popover do produto pareça a mesma família visual em vez de
 * cada tela inventar o seu.
 */

const MODAL_SIZE = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
} as const;

interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: LucideIcon;
  title: string;
  description?: string;
  size?: keyof typeof MODAL_SIZE;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function PremiumModal({ open, onOpenChange, icon: Icon, title, description, size = "md", children, footer, className }: PremiumModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(MODAL_SIZE[size], className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon ? (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                <Icon className="size-3.5" />
              </span>
            ) : null}
            {title}
          </DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

interface PremiumDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: LucideIcon;
  title: string;
  description?: string;
  side?: "left" | "right";
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function PremiumDrawer({ open, onOpenChange, icon: Icon, title, description, side = "right", children, footer, className }: PremiumDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={cn("glass sm:max-w-md", className)}>
        <SheetHeader className="border-b border-border/60">
          <SheetTitle className="flex items-center gap-2">
            {Icon ? (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                <Icon className="size-3.5" />
              </span>
            ) : null}
            {title}
          </SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">{children}</div>
        {footer ? <SheetFooter className="border-t border-border/60">{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}

interface PremiumPopoverProps {
  trigger: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}

export function PremiumPopover({ trigger, title, children, align = "center", className }: PremiumPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={cn("glass", className)}>
        {title ? <p className="text-xs font-semibold text-muted-foreground">{title}</p> : null}
        {children}
      </PopoverContent>
    </Popover>
  );
}
