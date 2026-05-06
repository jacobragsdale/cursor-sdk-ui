import {
  BarChartSpecObject,
  DataGridSpec,
  KpiCardSpec,
  LineChartSpec,
  PieChartSpec,
} from "../render-schemas";

const ack = { ok: true, rendered: true } as const;

export const renderTools = [
  {
    name: "render_kpi_card",
    description:
      "Render a single KPI card inline in the assistant's reply. Use for highlighting one number (AUM, weighted yield, etc.). The card appears in the chat — do NOT also describe the value in your text reply.",
    schema: KpiCardSpec,
    handler: async () => ack,
  },
  {
    name: "render_data_grid",
    description:
      "Render a sortable, paginated data grid inline. Use for tables of holdings or any tabular comparison. Pass `columns` (with optional `format` per column) and `rows` (objects keyed by column.field). The grid appears in the chat — your text reply should summarize takeaways, not re-list the rows.",
    schema: DataGridSpec,
    handler: async () => ack,
  },
  {
    name: "render_bar_chart",
    description:
      "Render a bar chart inline. Use for comparing categories (sector allocation, rating distribution, maturity buckets). Pass `xKey` (category field), `yKey` (numeric field), `data` (array of objects), and optionally `xLabel`, `yLabel`, and `orientation`. Prefer `orientation: \"horizontal\"` when category names are long. The chart appears in the chat — describe insights only.",
    schema: BarChartSpecObject,
    handler: async () => ack,
  },
  {
    name: "render_pie_chart",
    description:
      "Render a pie/donut chart inline. Use for parts-of-a-whole (sector or rating breakdowns). Pass `nameKey`, `valueKey`, and `data`. Optionally set `donut: true`. The chart appears in the chat — describe insights only.",
    schema: PieChartSpec,
    handler: async () => ack,
  },
  {
    name: "render_line_chart",
    description:
      "Render a multi-series line chart inline. Use for time-series or curve-shape data (yield curve, duration profile). Pass `xKey`, `series` (each with `name` and `yKey`), and `data`. The chart appears in the chat — describe insights only.",
    schema: LineChartSpec,
    handler: async () => ack,
  },
] as const;
