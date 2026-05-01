"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { DataGridSpec } from "@/lib/render-schemas";
import { cn, formatNumber } from "@/lib/utils";

type Row = Record<string, string | number | null>;

export function DataGridBlock({ spec }: { spec: DataGridSpec }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      spec.columns.map((c) => ({
        accessorKey: c.field,
        header: c.header,
        meta: { align: c.align, format: c.format, width: c.width },
        cell: ({ getValue }) => {
          const v = getValue();
          if (v == null) return <span className="text-[var(--color-fg-dim)]">—</span>;
          if (typeof v === "number") return formatNumber(v, c.format ?? "number");
          return String(v);
        },
      })),
    [spec.columns],
  );

  const table = useReactTable({
    data: spec.rows as Row[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-[0_12px_32px_rgba(0,0,0,0.16)]">
      {spec.title && (
        <div className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold">
          {spec.title}
        </div>
      )}
      <div className="thin-scroll max-h-[32rem] overflow-auto">
        <table className="w-full min-w-[760px] text-sm tabular-nums">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface-2)] text-[11px] uppercase tracking-wide text-[var(--color-fg-muted)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[var(--color-border)]">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as
                    | { align?: string; format?: string; width?: number }
                    | undefined;
                  const align =
                    meta?.align ??
                    (meta?.format
                      ? "right"
                      : "left");
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      className={cn(
                        "select-none px-3 py-2 font-medium",
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                        align === "left" && "text-left",
                      )}
                      style={meta?.width ? { width: meta.width } : undefined}
                    >
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex items-center gap-1",
                          align === "right" && "ml-auto",
                          "hover:text-[var(--color-fg)]",
                        )}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === "asc" && <ChevronUp className="size-3" />}
                        {sorted === "desc" && <ChevronDown className="size-3" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-[var(--color-border)]/60 last:border-b-0",
                  idx % 2 === 1 && "bg-[var(--color-surface-3)]/30",
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | { align?: string; format?: string; width?: number }
                    | undefined;
                  const align = meta?.align ?? (meta?.format ? "right" : "left");
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5 text-[var(--color-fg)]",
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                      )}
                      style={meta?.width ? { width: meta.width } : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {spec.caption && (
        <div className="border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-fg-dim)]">
          {spec.caption}
        </div>
      )}
    </div>
  );
}
