"use client";

import { AlertTriangle } from "lucide-react";
import {
  BarChartSpec,
  DataGridSpec,
  KpiCardSpec,
  LineChartSpec,
  PieChartSpec,
  isRenderToolName,
} from "@/lib/render-schemas";
import { BarChartBlock } from "./bar-chart";
import { DataGridBlock } from "./data-grid";
import { KpiCardBlock } from "./kpi-card";
import { LineChartBlock } from "./line-chart";
import { PieChartBlock } from "./pie-chart";

interface RenderBlockProps {
  name: string;
  args: unknown;
}

export function RenderBlock({ name, args }: RenderBlockProps) {
  if (!isRenderToolName(name)) {
    return <RenderError title="Unknown render tool" detail={name} />;
  }

  switch (name) {
    case "render_kpi_card": {
      const parsed = KpiCardSpec.safeParse(args);
      if (!parsed.success) return <ZodError name={name} error={parsed.error} />;
      return <KpiCardBlock spec={parsed.data} />;
    }
    case "render_data_grid": {
      const parsed = DataGridSpec.safeParse(args);
      if (!parsed.success) return <ZodError name={name} error={parsed.error} />;
      return <DataGridBlock spec={parsed.data} />;
    }
    case "render_bar_chart": {
      const parsed = BarChartSpec.safeParse(args);
      if (!parsed.success) return <ZodError name={name} error={parsed.error} />;
      return <BarChartBlock spec={parsed.data} />;
    }
    case "render_pie_chart": {
      const parsed = PieChartSpec.safeParse(args);
      if (!parsed.success) return <ZodError name={name} error={parsed.error} />;
      return <PieChartBlock spec={parsed.data} />;
    }
    case "render_line_chart": {
      const parsed = LineChartSpec.safeParse(args);
      if (!parsed.success) return <ZodError name={name} error={parsed.error} />;
      return <LineChartBlock spec={parsed.data} />;
    }
  }
}

function ZodError({ name, error }: { name: string; error: { issues: { path: (string | number)[]; message: string }[] } }) {
  return (
    <RenderError
      title={`Invalid args for ${name}`}
      detail={error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n")}
    />
  );
}

function RenderError({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-negative)]/40 bg-[var(--color-negative)]/5 p-4 text-sm">
      <div className="mb-1 flex items-center gap-2 font-medium text-[var(--color-negative)]">
        <AlertTriangle className="size-4" /> {title}
      </div>
      {detail && (
        <pre className="whitespace-pre-wrap text-xs text-[var(--color-fg-muted)]">{detail}</pre>
      )}
    </div>
  );
}
