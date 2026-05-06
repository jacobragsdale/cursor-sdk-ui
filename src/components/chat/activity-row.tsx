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
  status?: "running" | "completed" | "error";
  summary?: string;
}

export function ActivityRow({ name, status, summary }: ActivityRowProps) {
  const Icon = pickIcon(name, status);
  const label = humanize(name);
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
      <span className="shrink-0 text-[var(--color-fg-muted)]">{label}</span>
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
  if (name.includes("list_holdings") || name.includes("data_grid")) return Table2;
  if (name.startsWith("get_")) return Database;
  if (name.includes("search")) return Search;
  return ListChecks;
}

function humanize(name?: string): string {
  if (!name) return "Working";
  if (name === "analysis") return "Analysis";
  if (name === "get_portfolio_summary") return "Reading portfolio summary";
  if (name === "list_holdings") return "Listing holdings";
  if (name === "get_sector_allocation" || name === "get_muni_sector_exposure") return "Loading muni sector exposure";
  if (name === "get_state_exposure") return "Loading state exposure";
  if (name === "get_rating_distribution") return "Loading rating distribution";
  if (name === "get_maturity_buckets") return "Loading maturity buckets";
  if (name === "get_duration_buckets") return "Loading duration buckets";
  if (name === "get_tax_profile") return "Reading tax profile";
  if (name === "get_tax_equivalent_yield") return "Calculating TEY";
  if (name === "get_tax_lots") return "Reading tax lots";
  if (name === "get_tax_loss_harvest_candidates") return "Finding harvest candidates";
  if (name === "get_realized_gains_losses") return "Reading realized gains";
  if (name === "get_trade_history") return "Reading trades";
  if (name === "get_call_maturity_schedule") return "Loading call schedule";
  if (name === "get_cash_flow_projection") return "Projecting cash flows";
  if (name === "get_performance_vs_benchmark") return "Loading performance";
  if (name === "run_rate_spread_scenario") return "Running shock scenario";
  if (name === "get_credit_watchlist") return "Reading credit watchlist";
  if (name === "get_guideline_checks") return "Checking guidelines";
  if (name === "get_yield_curves") return "Loading yield curves";
  if (name.startsWith("render_")) return "Rendering";
  return name.replace(/_/g, " ");
}
