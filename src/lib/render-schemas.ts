import { z } from "zod";

const numberFormat = z.enum(["currency", "percent", "number", "compact", "decimal"]);

export const KpiCardSpec = z.object({
  label: z.string().min(1),
  value: z.number(),
  format: numberFormat.optional(),
  delta: z.number().optional(),
  deltaFormat: numberFormat.optional(),
  hint: z.string().optional(),
});
export type KpiCardSpec = z.infer<typeof KpiCardSpec>;

export const DataGridColumn = z.object({
  field: z.string().min(1),
  header: z.string().min(1),
  format: numberFormat.optional(),
  align: z.enum(["left", "right", "center"]).optional(),
  width: z.number().optional(),
});

export const DataGridSpec = z.object({
  title: z.string().optional(),
  columns: z.array(DataGridColumn).min(1),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).min(0),
  caption: z.string().optional(),
});
export type DataGridSpec = z.infer<typeof DataGridSpec>;

const chartDatum = z.record(z.string(), z.union([z.string(), z.number()]));

export const BarChartSpecObject = z.object({
  title: z.string().optional(),
  xKey: z.string().min(1),
  yKey: z.string().min(1),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  data: z.array(chartDatum).min(1),
  orientation: z.enum(["vertical", "horizontal"]).optional(),
  yFormat: numberFormat.optional(),
  caption: z.string().optional(),
});

export const BarChartSpec = BarChartSpecObject.superRefine((spec, ctx) => {
  for (let i = 0; i < spec.data.length; i++) {
    const row = spec.data[i];
    if (!(spec.xKey in row)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data", i, spec.xKey],
        message: `xKey "${spec.xKey}" missing from data[${i}]`,
      });
    }
    if (typeof row[spec.yKey] !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data", i, spec.yKey],
        message: `yKey "${spec.yKey}" at data[${i}] must be a number`,
      });
    }
  }
});
export type BarChartSpec = z.infer<typeof BarChartSpec>;

export const PieChartSpec = z.object({
  title: z.string().optional(),
  nameKey: z.string().min(1),
  valueKey: z.string().min(1),
  data: z.array(chartDatum).min(1),
  donut: z.boolean().optional(),
  valueFormat: numberFormat.optional(),
  caption: z.string().optional(),
});
export type PieChartSpec = z.infer<typeof PieChartSpec>;

export const LineSeries = z.object({
  name: z.string().min(1),
  yKey: z.string().min(1),
});

export const LineChartSpec = z.object({
  title: z.string().optional(),
  xKey: z.string().min(1),
  series: z.array(LineSeries).min(1),
  data: z.array(chartDatum).min(1),
  yFormat: numberFormat.optional(),
  caption: z.string().optional(),
});
export type LineChartSpec = z.infer<typeof LineChartSpec>;

export const RENDER_TOOL_NAMES = [
  "render_kpi_card",
  "render_data_grid",
  "render_bar_chart",
  "render_pie_chart",
  "render_line_chart",
] as const;
export type RenderToolName = (typeof RENDER_TOOL_NAMES)[number];

export function isRenderToolName(name: string): name is RenderToolName {
  return (RENDER_TOOL_NAMES as readonly string[]).includes(name);
}

export const RenderSpecByName = {
  render_kpi_card: KpiCardSpec,
  render_data_grid: DataGridSpec,
  render_bar_chart: BarChartSpec,
  render_pie_chart: PieChartSpec,
  render_line_chart: LineChartSpec,
} as const;
