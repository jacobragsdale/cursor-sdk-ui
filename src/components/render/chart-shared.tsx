"use client";

import { formatNumber } from "@/lib/utils";

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

export const axisStyle = {
  stroke: "var(--color-fg-dim)",
  fontSize: 11,
  tick: { fill: "var(--color-fg-muted)", fontSize: 11 },
  axisLine: { stroke: "var(--color-border)" },
  tickLine: { stroke: "var(--color-border)" },
} as const;

export function ChartContainer({
  title,
  caption,
  children,
}: {
  title?: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.16)] sm:p-5">
      {title && (
        <div className="mb-4 text-sm font-semibold text-[var(--color-fg)]">{title}</div>
      )}
      {children}
      {caption && (
        <div className="mt-3 text-xs leading-5 text-[var(--color-fg-dim)]">{caption}</div>
      )}
    </div>
  );
}

type ValueFormat = "currency" | "percent" | "number" | "compact" | "decimal";

interface TooltipPayloadEntry {
  name?: string | number;
  value?: string | number | (string | number)[];
  color?: string;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number | undefined;
  valueFormat?: ValueFormat;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormat,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-3)] px-3 py-2 text-xs shadow-xl">
      {label != null && (
        <div className="mb-1 text-[var(--color-fg-muted)]">{String(label)}</div>
      )}
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 tabular-nums">
          <span
            className="size-2 rounded-sm"
            style={{ background: entry.color ?? "var(--color-fg)" }}
          />
          <span className="flex-1 text-[var(--color-fg-muted)]">
            {entry.name != null ? String(entry.name) : ""}
          </span>
          <span className="text-[var(--color-fg)]">
            {typeof entry.value === "number"
              ? formatNumber(entry.value, valueFormat ?? "number")
              : entry.value != null
                ? String(entry.value)
                : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
