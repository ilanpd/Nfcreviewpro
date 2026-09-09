import type { BreakdownItem } from "@/types";

export function BreakdownList({ items, emptyLabel = "Sem dados no período" }: { items: BreakdownItem[]; emptyLabel?: string }) {
  const top = items.slice(0, 8);
  const max = Math.max(1, ...top.map((i) => i.count));

  if (top.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {top.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate capitalize">{item.label}</span>
            <span className="text-muted-foreground">{item.count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
