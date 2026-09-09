import { cn } from "cn";

/**
 * Skeleton States do NFC OS — usam a classe `.skeleton-shimmer` de
 * `globals.css` (respeita `prefers-reduced-motion` automaticamente) em vez
 * do `Skeleton` padrão do shadcn/ui (que só pulsa opacidade); mesma ideia,
 * uma camada visual a mais de acabamento.
 */
function Bone({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-md bg-muted", className)} />;
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Bone key={i} className={cn("h-3", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

const AVATAR_SIZE = { sm: "size-6", md: "size-8", lg: "size-10" } as const;

export function SkeletonAvatar({ size = "md" }: { size?: keyof typeof AVATAR_SIZE }) {
  return <Bone className={cn(AVATAR_SIZE[size], "rounded-full")} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-xl border border-border/60 bg-card p-5", className)}>
      <div className="flex items-center justify-between">
        <Bone className="h-3 w-24" />
        <Bone className="size-8 rounded-lg" />
      </div>
      <Bone className="h-7 w-20" />
      <Bone className="h-3 w-28" />
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-2", className)}>
      <Bone className="size-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Bone className="h-3 w-1/3" />
        <Bone className="h-2.5 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
