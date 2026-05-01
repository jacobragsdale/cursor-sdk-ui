import { z } from "zod";
import {
  durationBuckets,
  listHoldings,
  maturityBuckets,
  portfolioSummary,
  ratingDistribution,
  sectorAllocation,
  type ListHoldingsArgs,
} from "./data";

const sectorEnum = z.enum(["Treasury", "Agency", "IG Corp", "HY Corp", "Muni", "MBS"]);
const ratingEnum = z.enum(["AAA", "AA", "A", "BBB", "BB", "B"]);

export const dataTools = [
  {
    name: "get_portfolio_summary",
    description:
      "Return a high-level summary of the fixed-income portfolio: total market value, holdings count, weighted yield to maturity, weighted duration, weighted coupon, and as-of date.",
    inputShape: {} as Record<string, never>,
    handler: async () => portfolioSummary(),
  },
  {
    name: "list_holdings",
    description:
      "List individual bond holdings with all fields. Supports filtering by sector/rating, maturity range, and sorting. Use this when the user asks for a table of bonds, or when you need raw rows to feed into render_data_grid.",
    inputShape: {
      sector: sectorEnum.optional(),
      rating: ratingEnum.optional(),
      minMaturityYears: z.number().optional(),
      maxMaturityYears: z.number().optional(),
      sortBy: z
        .enum(["marketValue", "yieldToMaturity", "duration", "coupon", "maturityDate", "weight"])
        .optional(),
      sortDir: z.enum(["asc", "desc"]).optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
    handler: async (args: ListHoldingsArgs) => listHoldings(args),
  },
  {
    name: "get_sector_allocation",
    description:
      "Return market value and weight (in %) grouped by sector. Use this for sector breakdowns and allocation charts.",
    inputShape: {} as Record<string, never>,
    handler: async () => sectorAllocation(),
  },
  {
    name: "get_rating_distribution",
    description:
      "Return market value and weight (in %) grouped by credit rating, ordered AAA→B. Use this for credit-quality breakdowns.",
    inputShape: {} as Record<string, never>,
    handler: async () => ratingDistribution(),
  },
  {
    name: "get_maturity_buckets",
    description:
      "Return market value and weight grouped by years-to-maturity buckets (0-1y, 1-3y, 3-5y, 5-7y, 7-10y, 10-20y, 20+y).",
    inputShape: {} as Record<string, never>,
    handler: async () => maturityBuckets(),
  },
  {
    name: "get_duration_buckets",
    description:
      "Return market value and weight grouped by effective duration buckets (<1y, 1-3y, 3-5y, 5-7y, 7-10y, 10y+). Use for interest-rate-risk profiles.",
    inputShape: {} as Record<string, never>,
    handler: async () => durationBuckets(),
  },
] as const;
