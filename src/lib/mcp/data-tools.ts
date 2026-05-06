import { z } from "zod";
import {
  callMaturitySchedule,
  cashFlowProjection,
  creditWatchlist,
  durationBuckets,
  guidelineChecks,
  listHoldings,
  maturityBuckets,
  muniSectorExposure,
  performanceVsBenchmark,
  portfolioSummary,
  rateSpreadScenario,
  ratingDistribution,
  realizedGainsLosses,
  sectorAllocation,
  stateExposure,
  taxEquivalentYield,
  taxLossHarvestCandidates,
  taxLots,
  taxProfileExposure,
  tradeHistory,
  yieldCurves,
  type CallMaturityScheduleArgs,
  type CashFlowProjectionArgs,
  type HarvestCandidatesArgs,
  type ListHoldingsArgs,
  type PerformanceVsBenchmarkArgs,
  type RateSpreadScenarioArgs,
  type RealizedGainsLossesArgs,
  type TaxEquivalentYieldArgs,
  type TaxLotsArgs,
  type TradeHistoryArgs,
} from "./data";

const sectorEnum = z.enum(["Muni"]);
const ratingEnum = z.enum(["AAA", "AA", "A", "BBB", "BB", "B"]);
const muniSectorEnum = z.enum([
  "Local GO",
  "State GO",
  "State Appropriation",
  "Transportation",
  "Water/Sewer",
  "Education",
  "Healthcare",
  "Housing",
  "Other Revenue",
]);
const issuerTypeEnum = z.enum([
  "General Obligation",
  "State Appropriation",
  "Revenue",
  "Private Activity",
]);
const taxStatusEnum = z.enum(["FedExemptNYExempt", "FedExemptNYTaxable", "TaxableMuni"]);

export const dataTools = [
  {
    name: "get_portfolio_summary",
    description:
      "Return a high-level summary of the NY taxable municipal SMA: total market value, holdings count, weighted YTW, tax-equivalent yield, duration, NY weight, AMT weight, unrealized gain/loss, benchmark metadata, and tax assumptions.",
    inputShape: {} as Record<string, never>,
    handler: async () => portfolioSummary(),
  },
  {
    name: "list_holdings",
    description:
      "List individual municipal bond holdings with all enriched fields. Supports filtering by state, muni revenue sector, rating, AMT flag, callable status, maturity range, tax-equivalent yield, unrealized gain/loss, call date, and liquidity. Use for holdings tables and raw rows for render_data_grid.",
    inputShape: {
      sector: sectorEnum.optional(),
      rating: ratingEnum.optional(),
      state: z.string().length(2).optional(),
      revenueSector: muniSectorEnum.optional(),
      issuerType: issuerTypeEnum.optional(),
      taxStatus: taxStatusEnum.optional(),
      amtFlag: z.boolean().optional(),
      callable: z.boolean().optional(),
      minMaturityYears: z.number().optional(),
      maxMaturityYears: z.number().optional(),
      minTaxEquivalentYield: z.number().optional(),
      maxTaxEquivalentYield: z.number().optional(),
      minUnrealizedGainLoss: z.number().optional(),
      maxUnrealizedGainLoss: z.number().optional(),
      maxCallDate: z.string().optional(),
      minLiquidityScore: z.number().optional(),
      maxLiquidityScore: z.number().optional(),
      sortBy: z
        .enum([
          "marketValue",
          "yieldToMaturity",
          "yieldToWorst",
          "taxEquivalentYield",
          "amtAdjustedTaxEquivalentYield",
          "duration",
          "effectiveDuration",
          "coupon",
          "maturityDate",
          "callDate",
          "weight",
          "unrealizedGainLoss",
          "cleanPrice",
          "oas",
          "liquidityScore",
        ])
        .optional(),
      sortDir: z.enum(["asc", "desc"]).optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
    handler: async (args: ListHoldingsArgs) => listHoldings(args),
  },
  {
    name: "get_sector_allocation",
    description:
      "Return market value, weight, weighted YTW, tax-equivalent yield, duration, and unrealized gain/loss grouped by municipal revenue sector. Kept for existing sector-breakdown prompts.",
    inputShape: {} as Record<string, never>,
    handler: async () => sectorAllocation(),
  },
  {
    name: "get_muni_sector_exposure",
    description:
      "Return market value, weight, weighted YTW, tax-equivalent yield, duration, and unrealized gain/loss grouped by municipal revenue sector.",
    inputShape: {} as Record<string, never>,
    handler: async () => muniSectorExposure(),
  },
  {
    name: "get_state_exposure",
    description:
      "Return market value, weight, weighted YTW, tax-equivalent yield, duration, and NY tax treatment grouped by obligor state. Use for NY versus out-of-state exposure and TEY by state.",
    inputShape: {} as Record<string, never>,
    handler: async () => stateExposure(),
  },
  {
    name: "get_rating_distribution",
    description:
      "Return market value, weight, weighted YTW, tax-equivalent yield, duration, and unrealized gain/loss grouped by credit rating, ordered AAA to B.",
    inputShape: {} as Record<string, never>,
    handler: async () => ratingDistribution(),
  },
  {
    name: "get_maturity_buckets",
    description:
      "Return market value and weight grouped by years-to-maturity buckets (0-1y, 1-3y, 3-5y, 5-7y, 7-10y, 10-20y, 20+y), with yield and duration stats.",
    inputShape: {} as Record<string, never>,
    handler: async () => maturityBuckets(),
  },
  {
    name: "get_duration_buckets",
    description:
      "Return market value and weight grouped by effective-duration buckets (<1y, 1-3y, 3-5y, 5-7y, 7-10y, 10y+). Use for interest-rate-risk profiles.",
    inputShape: {} as Record<string, never>,
    handler: async () => durationBuckets(),
  },
  {
    name: "get_tax_profile",
    description:
      "Return the mock NY taxable investor profile, tax assumptions, tax-equivalent yield summary, federal-exempt exposure, NY-exempt exposure, NY-taxable out-of-state exposure, and AMT-flagged exposure. Use for tax profile and exposure questions.",
    inputShape: {} as Record<string, never>,
    handler: async () => taxProfileExposure(),
  },
  {
    name: "get_tax_equivalent_yield",
    description:
      "Return yield-to-worst, tax-equivalent yield, AMT-adjusted TEY, duration, and market value grouped by state, muni sector, issuer type, tax status, AMT flag, or individual holding.",
    inputShape: {
      groupBy: z
        .enum(["state", "revenueSector", "issuerType", "taxStatus", "amtFlag", "holding"])
        .optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
    handler: async (args: TaxEquivalentYieldArgs) => taxEquivalentYield(args),
  },
  {
    name: "get_tax_lots",
    description:
      "Return tax lots joined to current holdings, including cost basis, market value, unrealized gain/loss, holding period, wash-sale risk, replacement idea, and current yield data.",
    inputShape: {
      cusip: z.string().optional(),
      onlyLosses: z.boolean().optional(),
      minLossAmount: z.number().optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
    handler: async (args: TaxLotsArgs) => taxLots(args),
  },
  {
    name: "get_tax_loss_harvest_candidates",
    description:
      "Return tax-loss harvest or swap candidates from current tax lots, sorted by largest unrealized loss. Includes replacement ideas and wash-sale risk fields from the mock data.",
    inputShape: {
      minLossAmount: z.number().optional(),
      minLossPercent: z.number().optional(),
      limit: z.number().int().positive().max(50).optional(),
    },
    handler: async (args: HarvestCandidatesArgs) => taxLossHarvestCandidates(args),
  },
  {
    name: "get_realized_gains_losses",
    description:
      "Return realized gains, losses, estimated tax impact, and sell trades for a calendar year. Use for year-to-date realized gain/loss questions.",
    inputShape: {
      year: z.number().int().optional(),
    },
    handler: async (args: RealizedGainsLossesArgs) => realizedGainsLosses(args),
  },
  {
    name: "get_trade_history",
    description:
      "Return trade history with principal, accrued interest, commissions, realized gain/loss, estimated tax impact, and rationale. Filter by year, action, CUSIP, and limit.",
    inputShape: {
      year: z.number().int().optional(),
      action: z.enum(["Buy", "Sell"]).optional(),
      cusip: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
    handler: async (args: TradeHistoryArgs) => tradeHistory(args),
  },
  {
    name: "get_call_maturity_schedule",
    description:
      "Return callable bond call dates and maturity dates over a forward month horizon, including principal, market value, YTW, TEY, years to event, and reinvestment-risk flag.",
    inputShape: {
      months: z.number().int().positive().max(360).optional(),
    },
    handler: async (args: CallMaturityScheduleArgs) => callMaturitySchedule(args),
  },
  {
    name: "get_cash_flow_projection",
    description:
      "Return projected interest, principal, and total cash flows over a forward month horizon, either event-level or bucketed monthly, quarterly, or annual. Use for reinvestment and liquidity planning.",
    inputShape: {
      months: z.number().int().positive().max(360).optional(),
      bucket: z.enum(["event", "monthly", "quarterly", "annual"]).optional(),
    },
    handler: async (args: CashFlowProjectionArgs) => cashFlowProjection(args),
  },
  {
    name: "get_performance_vs_benchmark",
    description:
      "Return monthly portfolio returns, benchmark returns, excess returns, income returns, price returns, and compounded summary versus the custom muni benchmark.",
    inputShape: {
      periods: z.number().int().positive().max(120).optional(),
    },
    handler: async (args: PerformanceVsBenchmarkArgs) => performanceVsBenchmark(args),
  },
  {
    name: "run_rate_spread_scenario",
    description:
      "Estimate price impact and P&L for rate and/or spread shocks using effective duration and a simplified spread-duration assumption. Supports preset scenarioId or explicit rateShockBp/spreadShockBp and grouping by muni sector, state, rating, or holding.",
    inputShape: {
      scenarioId: z.string().optional(),
      rateShockBp: z.number().optional(),
      spreadShockBp: z.number().optional(),
      groupBy: z.enum(["revenueSector", "state", "rating", "holding"]).optional(),
    },
    handler: async (args: RateSpreadScenarioArgs) => rateSpreadScenario(args),
  },
  {
    name: "get_credit_watchlist",
    description:
      "Return current credit watchlist items joined to holdings, including severity, reason, next review date, recommended action, weight, yield, liquidity, and unrealized gain/loss.",
    inputShape: {} as Record<string, never>,
    handler: async () => creditWatchlist(),
  },
  {
    name: "get_guideline_checks",
    description:
      "Return guideline checks with actual values, limits, headroom, severity, and pass/watch/fail status. Use for compliance and portfolio-construction guardrail questions.",
    inputShape: {} as Record<string, never>,
    handler: async () => guidelineChecks(),
  },
  {
    name: "get_yield_curves",
    description:
      "Return AAA muni, NY AAA muni, Treasury, and NY tax-equivalent yield curve points. Use for curve-shape, reinvestment, and relative-value questions.",
    inputShape: {} as Record<string, never>,
    handler: async () => yieldCurves(),
  },
] as const;
