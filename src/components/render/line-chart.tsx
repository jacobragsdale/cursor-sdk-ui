"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LineChartSpec } from "@/lib/render-schemas";
import { formatNumber } from "@/lib/utils";
import { ChartContainer, ChartTooltipContent, CHART_COLORS, axisStyle } from "./chart-shared";

export function LineChartBlock({ spec }: { spec: LineChartSpec }) {
  return (
    <ChartContainer title={spec.title} caption={spec.caption}>
      <div className="h-[300px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={spec.data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey={spec.xKey} tickMargin={8} {...axisStyle} />
            <YAxis
              tickFormatter={(v) => formatNumber(Number(v), spec.yFormat ?? "number")}
              {...axisStyle}
            />
            <Tooltip content={(props) => <ChartTooltipContent {...props} valueFormat={spec.yFormat} />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "var(--color-fg-muted)", paddingTop: 8 }}
              iconType="circle"
            />
            {spec.series.map((s, idx) => (
              <Line
                key={s.yKey}
                type="monotone"
                dataKey={s.yKey}
                name={s.name}
                stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
