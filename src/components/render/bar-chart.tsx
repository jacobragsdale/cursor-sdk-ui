"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BarChartSpec } from "@/lib/render-schemas";
import { formatNumber } from "@/lib/utils";
import { ChartContainer, ChartTooltipContent, CHART_COLORS, axisStyle } from "./chart-shared";

const LONG_LABEL_THRESHOLD = 10;

function resolveOrientation(spec: BarChartSpec): "vertical" | "horizontal" {
  if (spec.orientation) return spec.orientation;
  const maxLabelLen = spec.data.reduce(
    (m, d) => Math.max(m, String(d[spec.xKey] ?? "").length),
    0,
  );
  return maxLabelLen > LONG_LABEL_THRESHOLD ? "horizontal" : "vertical";
}

const labelStyle = {
  fill: "var(--color-fg-muted)",
  fontSize: 11,
  textAnchor: "middle" as const,
};

export function BarChartBlock({ spec }: { spec: BarChartSpec }) {
  const horizontal = resolveOrientation(spec) === "horizontal";
  const height = horizontal
    ? Math.min(440, Math.max(240, spec.data.length * 36 + 56))
    : 280;

  const categoryLabel = spec.xLabel;
  const valueLabel = spec.yLabel;
  const barName = spec.yLabel ?? spec.yKey;

  const maxCategoryLen = horizontal
    ? spec.data.reduce(
        (m, d) => Math.max(m, String(d[spec.xKey] ?? "").length),
        0,
      )
    : 0;
  const yAxisWidth = horizontal
    ? Math.min(180, Math.max(72, maxCategoryLen * 7 + 16))
    : 60;

  const numericTickFormatter = (v: number) =>
    formatNumber(Number(v), spec.yFormat ?? "number");

  const bottomMargin = horizontal
    ? valueLabel
      ? 28
      : 8
    : categoryLabel
      ? 28
      : 8;
  const leftMargin = !horizontal && valueLabel ? 12 : horizontal ? 8 : 0;

  const categoryAxis = horizontal ? (
    <YAxis
      dataKey={spec.xKey}
      type="category"
      width={yAxisWidth}
      tickMargin={8}
      {...axisStyle}
    />
  ) : (
    <XAxis dataKey={spec.xKey} tickMargin={8} {...axisStyle}>
      {categoryLabel ? (
        <Label
          value={categoryLabel}
          position="insideBottom"
          offset={-18}
          style={labelStyle}
        />
      ) : null}
    </XAxis>
  );

  const valueAxis = horizontal ? (
    <XAxis type="number" tickFormatter={numericTickFormatter} {...axisStyle}>
      {valueLabel ? (
        <Label
          value={valueLabel}
          position="insideBottom"
          offset={-18}
          style={labelStyle}
        />
      ) : null}
    </XAxis>
  ) : (
    <YAxis tickFormatter={numericTickFormatter} {...axisStyle}>
      {valueLabel ? (
        <Label
          value={valueLabel}
          angle={-90}
          position="insideLeft"
          offset={0}
          style={labelStyle}
        />
      ) : null}
    </YAxis>
  );

  return (
    <ChartContainer title={spec.title} caption={spec.caption}>
      <div className="min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={spec.data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 8, right: 16, bottom: bottomMargin, left: leftMargin }}
            barCategoryGap={horizontal ? 10 : 16}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={horizontal}
              horizontal={!horizontal}
            />
            {valueAxis}
            {categoryAxis}
            <Tooltip
              cursor={{ fill: "var(--color-surface-3)", opacity: 0.4 }}
              content={(props) => (
                <ChartTooltipContent {...props} valueFormat={spec.yFormat} />
              )}
            />
            <Bar
              name={barName}
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
