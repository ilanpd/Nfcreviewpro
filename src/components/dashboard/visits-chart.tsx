"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { TimeseriesPoint } from "@/types";

const chartConfig = {
  visits: { label: "Acessos", color: "var(--chart-1)" },
  googleClicks: { label: "Cliques no Google", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function VisitsChart({ data }: { data: TimeseriesPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 12 }}>
        <defs>
          <linearGradient id="fillVisits" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-visits)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-visits)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillGoogle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-googleClicks)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-googleClicks)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(value: string) => value.slice(5).replace("-", "/")}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <Area dataKey="visits" type="monotone" fill="url(#fillVisits)" stroke="var(--color-visits)" strokeWidth={2} />
        <Area
          dataKey="googleClicks"
          type="monotone"
          fill="url(#fillGoogle)"
          stroke="var(--color-googleClicks)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
