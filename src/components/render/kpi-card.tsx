"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { KpiCardSpec } from "@/lib/render-schemas";
import { cn, formatNumber } from "@/lib/utils";

export function KpiCardBlock({ spec }: { spec: KpiCardSpec }) {
  const { label, value, format, delta, deltaFormat, hint } = spec;
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="min-h-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.16)]">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight text-[var(--color-fg)] tabular-nums sm:text-3xl">
          {formatNumber(value, format ?? "number")}
        </div>
        {delta != null && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs tabular-nums",
              positive
                ? "bg-[var(--color-positive)]/10 text-[var(--color-positive)]"
                : "bg-[var(--color-negative)]/10 text-[var(--color-negative)]",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {formatNumber(Math.abs(delta), deltaFormat ?? format ?? "number")}
          </div>
        )}
      </div>
      {hint && <div className="mt-3 text-xs leading-5 text-[var(--color-fg-dim)]">{hint}</div>}
    </div>
  );
}
