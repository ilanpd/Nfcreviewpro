"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { BreakdownItem } from "@/types";

const chartConfig = {
  count: { label: "Acessos", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function HourlyChart({ data }: { data: BreakdownItem[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart data={data} margin={{ left: 0, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={2} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
