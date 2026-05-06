"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BarChartSpec } from "@/lib/render-schemas";
import { formatNumber } from "@/lib/utils";
import { ChartContainer, ChartTooltipContent, CHART_COLORS, axisStyle } from "./chart-shared";

export function BarChartBlock({ spec }: { spec: BarChartSpec }) {
  const horizontal = spec.orientation === "horizontal";
  const height = horizontal
    ? Math.min(440, Math.max(240, spec.data.length * 36 + 56))
    : 280;

  return (
    <ChartContainer title={spec.title} caption={spec.caption}>
      <div className="min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={spec.data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 16, bottom: 8, left: horizontal ? 96 : 0 }}
          barCategoryGap={horizontal ? 10 : 16}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tickFormatter={(v) => formatNumber(Number(v), spec.yFormat ?? "number")}
                {...axisStyle}
              />
              <YAxis dataKey={spec.xKey} type="category" width={96} tickMargin={8} {...axisStyle} />
            </>
          ) : (
            <>
              <XAxis dataKey={spec.xKey} tickMargin={8} {...axisStyle} />
              <YAxis
                tickFormatter={(v) => formatNumber(Number(v), spec.yFormat ?? "number")}
                {...axisStyle}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: "var(--color-surface-3)", opacity: 0.4 }}
            content={(props) => (
              <ChartTooltipContent
                {...props}
                valueFormat={spec.yFormat}
              />
            )}
          />
          <Bar
            dataKey={spec.yKey}
            fill={CHART_COLORS[0]}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          >
            {spec.data.map((_, idx) => (
              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
