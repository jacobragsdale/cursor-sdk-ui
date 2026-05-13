"use client";

import {
  AlertCircle,
  CheckCircle2,
  Database,
  ListChecks,
  Loader2,
  Search,
  Table2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityRowProps {
  name?: string;
  label?: string;
  status?: "running" | "completed" | "error";
  summary?: string;
}

export function ActivityRow({ name, label, status, summary }: ActivityRowProps) {
  const Icon = pickIcon(name, status);
  const display = label ?? humanize(name);
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/65 px-2.5 py-1.5 text-xs text-[var(--color-fg-muted)]">
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          status === "running" && "animate-spin text-[var(--color-accent)]",
          status === "completed" && "text-[var(--color-positive)]",
          status === "error" && "text-[var(--color-negative)]",
        )}
      />
      <span className="shrink-0 text-[var(--color-fg-muted)]">{display}</span>
      {summary && (
        <span className="truncate font-mono text-[11px] text-[var(--color-fg-dim)]">
          · {summary}
        </span>
      )}
    </div>
  );
}

function pickIcon(name?: string, status?: string): LucideIcon {
  if (status === "running") return Loader2;
  if (status === "error") return AlertCircle;
  if (status === "completed") return CheckCircle2;
  if (!name) return ListChecks;
  if (name === "analysis") return ListChecks;
  const bare = stripPackPrefix(name);
  if (bare.includes("list_holdings") || bare.includes("data_grid")) return Table2;
  if (bare.startsWith("get_")) return Database;
  if (bare.includes("search")) return Search;
  return ListChecks;
}

function humanize(name?: string): string {
  if (!name) return "Working";
  if (name === "analysis") return "Analysis";
  if (name.startsWith("render_")) return "Rendering";
  const bare = stripPackPrefix(name);
  return bare.replace(/^get_/, "").replace(/_/g, " ").trim() || "Working";
}

function stripPackPrefix(name: string): string {
  const idx = name.indexOf("__");
  return idx > 0 ? name.slice(idx + 2) : name;
}
