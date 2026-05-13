import { formatNumber } from "@/lib/utils";
import type { PackHeaderSummary } from "../types";
import { portfolioSummary } from "./data";

export function portfolioHeaderSummary(): PackHeaderSummary {
  const summary = portfolioSummary();
  return {
    asOf: summary.asOf,
    metrics: [
      {
        label: "Market value",
        value: formatNumber(summary.totalMarketValue, "currency"),
      },
      {
        label: "NY weight",
        value: formatNumber(summary.nyWeight, "percent", 2),
      },
      {
        label: "Tax-equiv YTW",
        value: formatNumber(summary.weightedTaxEquivalentYield, "percent", 2),
      },
      {
        label: "Duration",
        value: formatNumber(summary.weightedDuration, "decimal", 2),
      },
    ],
  };
}
