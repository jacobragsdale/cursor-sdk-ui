import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  value: number,
  format?: "currency" | "percent" | "number" | "compact" | "decimal",
  digits = 2,
) {
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "currency":
      return formatCurrency(value);
    case "percent":
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: digits,
      }).format(value / 100);
    case "compact":
      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    case "decimal":
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value);
    case "number":
    default:
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
  }
}

function formatCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${trimFixed(value / 1_000_000_000, 1)}B`;
  if (abs >= 1_000_000) return `$${trimFixed(value / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `$${trimFixed(value / 1_000, 1)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function trimFixed(value: number, digits: number) {
  return value.toFixed(digits).replace(/\.0$/, "");
}
