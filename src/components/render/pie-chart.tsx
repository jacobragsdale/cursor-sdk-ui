"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PieChartSpec } from "@/lib/render-schemas";
import { formatNumber } from "@/lib/utils";
import { ChartContainer, ChartTooltipContent, CHART_COLORS } from "./chart-shared";

export function PieChartBlock({ spec }: { spec: PieChartSpec }) {
  const total = spec.data.reduce((sum, d) => {
    const v = d[spec.valueKey];
    return sum + (typeof v === "number" ? v : 0);
  }, 0);
  const showShare = spec.valueFormat !== "percent";

  return (
    <ChartContainer title={spec.title} caption={spec.caption}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)] md:items-center">
        <div className="h-[260px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={spec.data}
                dataKey={spec.valueKey}
                nameKey={spec.nameKey}
                innerRadius={spec.donut ? 56 : 0}
                outerRadius={96}
                paddingAngle={1}
                stroke="var(--color-bg)"
                strokeWidth={2}
                labelLine={false}
              >
                {spec.data.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={(props) => (
                  <ChartTooltipContent {...props} valueFormat={spec.valueFormat} />
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex min-w-0 flex-col gap-2">
          {spec.data.map((d, idx) => {
            const value = d[spec.valueKey];
            const numericValue = typeof value === "number" ? value : 0;
            const share = total > 0 ? numericValue / total : 0;
            return (
              <li key={idx} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                <span className="flex-1 truncate text-[var(--color-fg)]">{String(d[spec.nameKey])}</span>
                <span className="text-right tabular-nums text-[var(--color-fg-muted)]">
                  {showShare
                    ? `${formatNumber(numericValue, spec.valueFormat ?? "number")} · ${formatNumber(share * 100, "decimal", 1)}%`
                    : formatNumber(numericValue, spec.valueFormat ?? "number")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartContainer>
  );
}
