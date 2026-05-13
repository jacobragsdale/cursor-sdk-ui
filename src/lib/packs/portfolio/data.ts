import { readFileSync } from "node:fs";
import path from "node:path";

export type Sector = "Muni";
export type Rating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B";
export type MuniSector =
  | "Local GO"
  | "State GO"
  | "State Appropriation"
  | "Transportation"
  | "Water/Sewer"
  | "Education"
  | "Healthcare"
  | "Housing"
  | "Other Revenue";
export type IssuerType =
  | "General Obligation"
  | "State Appropriation"
  | "Revenue"
  | "Private Activity";
export type TaxStatus = "FedExemptNYExempt" | "FedExemptNYTaxable" | "TaxableMuni";

export interface ClientProfile {
  clientName: string;
  domicileState: string;
  accountType: string;
  investorType: string;
  federalTaxRate: number;
  stateTaxRate: number;
  netInvestmentIncomeTaxRate: number;
  subjectToAMT: boolean;
  objective: string;
  riskTolerance: string;
  restrictions: string[];
}

export interface TaxRules {
  federalTaxExemptInterest: string;
  nyResidentTreatment: string;
  taxEquivalentYieldFormula: string;
  mockDataNotice: string;
  sourceNotes: Array<{ label: string; url: string }>;
}

export interface Benchmark {
  name: string;
  yieldToWorst: number;
  taxEquivalentYield: number;
  effectiveDuration: number;
  averageRating: Rating;
  stateWeights: Array<{ state: string; weight: number }>;
  sectorWeights: Array<{ revenueSector: string; weight: number }>;
}

export interface YieldCurvePoint {
  tenor: string;
  years: number;
  aaaMuni: number;
  nyAaaMuni: number;
  treasury: number;
  nyTaxEquivalent: number;
}

export interface PerformanceMonth {
  date: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  incomeReturn: number;
  priceReturn: number;
}

export interface Holding {
  cusip: string;
  issuer: string;
  description: string;
  sector: Sector;
  state: string;
  issuerType: IssuerType;
  revenueSector: MuniSector;
  taxStatus: TaxStatus;
  federalTaxExempt: boolean;
  stateTaxExempt: boolean;
  amtFlag: boolean;
  insured: boolean;
  insurance: string | null;
  rating: Rating;
  creditOutlook: "Stable" | "Positive" | "Negative" | "Watch";
  coupon: number;
  maturityDate: string;
  callable: boolean;
  callDate: string | null;
  callPrice: number | null;
  parValue: number;
  cleanPrice: number;
  marketValue: number;
  costBasis: number;
  accruedInterest: number;
  unrealizedGainLoss: number;
  yieldToMaturity: number;
  yieldToWorst: number;
  yieldToCall: number | null;
  oas: number;
  spread: number;
  effectiveDuration: number;
  duration: number;
  liquidityScore: number;
  weight: number;
  taxEquivalentYield: number;
  amtAdjustedTaxEquivalentYield: number;
}

export interface Transaction {
  tradeDate: string;
  settlementDate: string;
  cusip: string;
  issuer: string;
  action: "Buy" | "Sell";
  parValue: number;
  price: number;
  principal: number;
  accruedInterest: number;
  commission: number;
  realizedGainLoss: number;
  taxImpact: number;
  rationale: string;
}

export interface TaxLot {
  lotId: string;
  cusip: string;
  acquiredDate: string;
  parValue: number;
  costBasis: number;
  marketValue: number;
  unrealizedGainLoss: number;
  holdingPeriod: "Short" | "Long";
  washSaleRisk: "Low" | "Medium" | "High";
  replacementIdea: string;
}

export interface CashFlow {
  date: string;
  eventType: "Coupon" | "Expected Call" | "Maturity";
  cusip: string | null;
  interest: number;
  principal: number;
  totalCashFlow: number;
}

export interface RiskScenario {
  id: string;
  label: string;
  rateShockBp: number;
  spreadShockBp: number;
}

export interface CreditWatchItem {
  cusip: string;
  issuer: string;
  severity: "Low" | "Medium" | "High";
  reason: string;
  nextReviewDate: string;
  recommendedAction: string;
}

export interface Guideline {
  id: string;
  name: string;
  metric:
    | "nyStateWeight"
    | "nonNyWeight"
    | "singleIssuerWeight"
    | "belowAWeight"
    | "amtWeight"
    | "illiquidWeight"
    | "largestSectorWeight";
  operator: "min" | "max";
  limit: number;
  severity: "Hard" | "Soft";
}

export interface Portfolio {
  asOf: string;
  baseCurrency: string;
  totalMarketValue: number;
  state: string;
  federalTaxRate: number;
  stateTaxRate: number;
  accountType: string;
  investorType: string;
  benchmarkIndex: string;
  inceptionDate: string;
  clientProfile: ClientProfile;
  taxRules: TaxRules;
  benchmark: Benchmark;
  yieldCurves: { asOf: string; points: YieldCurvePoint[] };
  performanceHistory: PerformanceMonth[];
  holdings: Holding[];
  transactions: Transaction[];
  taxLots: TaxLot[];
  cashFlows: CashFlow[];
  riskScenarios: RiskScenario[];
  creditWatchlist: CreditWatchItem[];
  guidelines: Guideline[];
}

type RawHolding = Omit<Holding, "weight" | "taxEquivalentYield" | "amtAdjustedTaxEquivalentYield">;
type RawPortfolio = Omit<Portfolio, "holdings"> & { holdings: RawHolding[] };

const DATA_PATH = path.resolve(process.cwd(), "data/portfolio.json");

let cache: Portfolio | null = null;

export function loadPortfolio(): Portfolio {
  if (cache) return cache;
  const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as RawPortfolio;
  const total = raw.totalMarketValue;
  const holdings: Holding[] = raw.holdings.map((h) => ({
    ...h,
    weight: (h.marketValue / total) * 100,
    taxEquivalentYield: round(taxEquivalentYieldForHolding(h, raw), 3),
    amtAdjustedTaxEquivalentYield: round(taxEquivalentYieldForHolding(h, raw, true), 3),
  }));
  cache = { ...raw, holdings };
  return cache;
}

export function portfolioSummary() {
  const p = loadPortfolio();
  const totalMv = p.totalMarketValue;
  const weightedYtm = weightedAverage(p.holdings, (h) => h.yieldToMaturity);
  const weightedYtw = weightedAverage(p.holdings, (h) => h.yieldToWorst);
  const weightedDuration = weightedAverage(p.holdings, (h) => h.effectiveDuration);
  const weightedCoupon = weightedAverage(p.holdings, (h) => h.coupon);
  const weightedTey = weightedAverage(p.holdings, (h) => h.taxEquivalentYield);
  const amtAdjustedTey = weightedAverage(p.holdings, (h) => h.amtAdjustedTaxEquivalentYield);
  const nyMarketValue = sum(p.holdings.filter((h) => h.state === p.state), (h) => h.marketValue);
  const amtMarketValue = sum(p.holdings.filter((h) => h.amtFlag), (h) => h.marketValue);
  const callableMarketValue = sum(p.holdings.filter((h) => h.callable), (h) => h.marketValue);

  return {
    asOf: p.asOf,
    baseCurrency: p.baseCurrency,
    totalMarketValue: totalMv,
    holdingsCount: p.holdings.length,
    weightedYieldToMaturity: round(weightedYtm, 3),
    weightedYieldToWorst: round(weightedYtw, 3),
    weightedTaxEquivalentYield: round(weightedTey, 3),
    amtAdjustedTaxEquivalentYield: round(amtAdjustedTey, 3),
    weightedDuration: round(weightedDuration, 2),
    weightedCoupon: round(weightedCoupon, 3),
    totalParValue: sum(p.holdings, (h) => h.parValue),
    totalCostBasis: sum(p.holdings, (h) => h.costBasis),
    totalAccruedInterest: sum(p.holdings, (h) => h.accruedInterest),
    totalUnrealizedGainLoss: sum(p.holdings, (h) => h.unrealizedGainLoss),
    nyMarketValue,
    nyWeight: round((nyMarketValue / totalMv) * 100, 2),
    nonNyWeight: round(((totalMv - nyMarketValue) / totalMv) * 100, 2),
    amtMarketValue,
    amtWeight: round((amtMarketValue / totalMv) * 100, 2),
    callableMarketValue,
    callableWeight: round((callableMarketValue / totalMv) * 100, 2),
    state: p.state,
    federalTaxRate: p.clientProfile.federalTaxRate,
    stateTaxRate: p.clientProfile.stateTaxRate,
    accountType: p.accountType,
    investorType: p.investorType,
    benchmarkIndex: p.benchmarkIndex,
    inceptionDate: p.inceptionDate,
    benchmarkYieldToWorst: p.benchmark.yieldToWorst,
    benchmarkTaxEquivalentYield: p.benchmark.taxEquivalentYield,
    benchmarkDuration: p.benchmark.effectiveDuration,
  };
}

export function sectorAllocation() {
  return groupHoldings((h) => h.revenueSector).map((g) => ({
    sector: g.key,
    revenueSector: g.key,
    ...exposureStats(g.holdings),
  }));
}

export function muniSectorExposure() {
  return sectorAllocation();
}

export function stateExposure() {
  return groupHoldings((h) => h.state).map((g) => {
    const stats = exposureStats(g.holdings);
    return {
      state: g.key,
      stateTaxTreatment: g.key === loadPortfolio().state ? "NY exempt" : "NY taxable",
      ...stats,
    };
  });
}

export function ratingDistribution() {
  const order: Rating[] = ["AAA", "AA", "A", "BBB", "BB", "B"];
  return groupHoldings((h) => h.rating)
    .sort((a, b) => order.indexOf(a.key as Rating) - order.indexOf(b.key as Rating))
    .map((g) => ({ rating: g.key, ...exposureStats(g.holdings) }));
}

export function maturityBuckets() {
  const buckets = [
    { key: "0-1y", min: 0, max: 1 },
    { key: "1-3y", min: 1, max: 3 },
    { key: "3-5y", min: 3, max: 5 },
    { key: "5-7y", min: 5, max: 7 },
    { key: "7-10y", min: 7, max: 10 },
    { key: "10-20y", min: 10, max: 20 },
    { key: "20+y", min: 20, max: Infinity },
  ];
  const p = loadPortfolio();
  const now = new Date(p.asOf);
  return buckets.map((b) => {
    const holdings = p.holdings.filter((h) => {
      const years = yearsBetween(now, new Date(h.maturityDate));
      return years >= b.min && years < b.max;
    });
    return { bucket: b.key, ...exposureStats(holdings) };
  });
}

export function durationBuckets() {
  const buckets = [
    { key: "<1y", min: 0, max: 1 },
    { key: "1-3y", min: 1, max: 3 },
    { key: "3-5y", min: 3, max: 5 },
    { key: "5-7y", min: 5, max: 7 },
    { key: "7-10y", min: 7, max: 10 },
    { key: "10y+", min: 10, max: Infinity },
  ];
  const p = loadPortfolio();
  return buckets.map((b) => {
    const holdings = p.holdings.filter((h) => h.effectiveDuration >= b.min && h.effectiveDuration < b.max);
    return { bucket: b.key, ...exposureStats(holdings) };
  });
}

export interface ListHoldingsArgs {
  sector?: Sector;
  rating?: Rating;
  state?: string;
  revenueSector?: MuniSector;
  issuerType?: IssuerType;
  taxStatus?: TaxStatus;
  amtFlag?: boolean;
  callable?: boolean;
  minMaturityYears?: number;
  maxMaturityYears?: number;
  minTaxEquivalentYield?: number;
  maxTaxEquivalentYield?: number;
  minUnrealizedGainLoss?: number;
  maxUnrealizedGainLoss?: number;
  maxCallDate?: string;
  minLiquidityScore?: number;
  maxLiquidityScore?: number;
  sortBy?:
    | "marketValue"
    | "yieldToMaturity"
    | "yieldToWorst"
    | "taxEquivalentYield"
    | "amtAdjustedTaxEquivalentYield"
    | "duration"
    | "effectiveDuration"
    | "coupon"
    | "maturityDate"
    | "callDate"
    | "weight"
    | "unrealizedGainLoss"
    | "cleanPrice"
    | "oas"
    | "liquidityScore";
  sortDir?: "asc" | "desc";
  limit?: number;
}

export function listHoldings(args: ListHoldingsArgs = {}) {
  const p = loadPortfolio();
  const now = new Date(p.asOf);
  let rows = p.holdings.slice();
  if (args.sector) rows = rows.filter((h) => h.sector === args.sector);
  if (args.rating) rows = rows.filter((h) => h.rating === args.rating);
  if (args.state) {
    const state = args.state.toUpperCase();
    rows = rows.filter((h) => h.state === state);
  }
  if (args.revenueSector) rows = rows.filter((h) => h.revenueSector === args.revenueSector);
  if (args.issuerType) rows = rows.filter((h) => h.issuerType === args.issuerType);
  if (args.taxStatus) rows = rows.filter((h) => h.taxStatus === args.taxStatus);
  if (args.amtFlag != null) rows = rows.filter((h) => h.amtFlag === args.amtFlag);
  if (args.callable != null) rows = rows.filter((h) => h.callable === args.callable);
  if (args.minTaxEquivalentYield != null) {
    rows = rows.filter((h) => h.taxEquivalentYield >= args.minTaxEquivalentYield!);
  }
  if (args.maxTaxEquivalentYield != null) {
    rows = rows.filter((h) => h.taxEquivalentYield <= args.maxTaxEquivalentYield!);
  }
  if (args.minUnrealizedGainLoss != null) {
    rows = rows.filter((h) => h.unrealizedGainLoss >= args.minUnrealizedGainLoss!);
  }
  if (args.maxUnrealizedGainLoss != null) {
    rows = rows.filter((h) => h.unrealizedGainLoss <= args.maxUnrealizedGainLoss!);
  }
  if (args.maxCallDate) {
    const maxCallTime = new Date(args.maxCallDate).getTime();
    rows = rows.filter((h) => h.callDate && new Date(h.callDate).getTime() <= maxCallTime);
  }
  if (args.minLiquidityScore != null) {
    rows = rows.filter((h) => h.liquidityScore >= args.minLiquidityScore!);
  }
  if (args.maxLiquidityScore != null) {
    rows = rows.filter((h) => h.liquidityScore <= args.maxLiquidityScore!);
  }
  if (args.minMaturityYears != null || args.maxMaturityYears != null) {
    rows = rows.filter((h) => {
      const years = yearsBetween(now, new Date(h.maturityDate));
      if (args.minMaturityYears != null && years < args.minMaturityYears) return false;
      if (args.maxMaturityYears != null && years > args.maxMaturityYears) return false;
      return true;
    });
  }

  const sortKey = args.sortBy ?? "marketValue";
  const dir = args.sortDir ?? "desc";
  rows.sort((a, b) => compareNullable(sortableHoldingValue(a, sortKey), sortableHoldingValue(b, sortKey), dir));
  if (args.limit && args.limit > 0) rows = rows.slice(0, args.limit);
  return rows.map(holdingRow);
}

export function taxProfileExposure() {
  const p = loadPortfolio();
  const summary = portfolioSummary();
  const federalExemptMv = sum(p.holdings.filter((h) => h.federalTaxExempt), (h) => h.marketValue);
  const nyExemptMv = sum(p.holdings.filter((h) => h.stateTaxExempt), (h) => h.marketValue);
  const nyTaxableMv = p.totalMarketValue - nyExemptMv;
  const amtMv = sum(p.holdings.filter((h) => h.amtFlag), (h) => h.marketValue);

  return {
    profile: p.clientProfile,
    taxRules: p.taxRules,
    summary: {
      weightedYieldToWorst: summary.weightedYieldToWorst,
      weightedTaxEquivalentYield: summary.weightedTaxEquivalentYield,
      amtAdjustedTaxEquivalentYield: summary.amtAdjustedTaxEquivalentYield,
      federalTaxRate: p.clientProfile.federalTaxRate,
      stateTaxRate: p.clientProfile.stateTaxRate,
      subjectToAMT: p.clientProfile.subjectToAMT,
    },
    exposures: [
      exposureRow("Federal tax-exempt interest", federalExemptMv),
      exposureRow("NY state tax-exempt interest", nyExemptMv),
      exposureRow("Other-state interest taxable to NY", nyTaxableMv),
      exposureRow("AMT-flagged private activity", amtMv),
    ],
  };
}

export interface TaxEquivalentYieldArgs {
  groupBy?: "state" | "revenueSector" | "issuerType" | "taxStatus" | "amtFlag" | "holding";
  limit?: number;
}

export function taxEquivalentYield(args: TaxEquivalentYieldArgs = {}) {
  const p = loadPortfolio();
  const groupBy = args.groupBy ?? "state";
  if (groupBy === "holding") {
    const rows = p.holdings
      .slice()
      .sort((a, b) => b.taxEquivalentYield - a.taxEquivalentYield)
      .slice(0, args.limit ?? p.holdings.length)
      .map((h) => ({
        cusip: h.cusip,
        issuer: h.issuer,
        state: h.state,
        revenueSector: h.revenueSector,
        rating: h.rating,
        yieldToWorst: h.yieldToWorst,
        taxEquivalentYield: h.taxEquivalentYield,
        amtAdjustedTaxEquivalentYield: h.amtAdjustedTaxEquivalentYield,
        amtFlag: h.amtFlag ? "Yes" : "No",
        marketValue: h.marketValue,
        weight: round(h.weight, 2),
      }));
    return { groupBy, rows };
  }

  const groups = groupHoldings((h) => {
    if (groupBy === "amtFlag") return h.amtFlag ? "AMT" : "Non-AMT";
    return String(h[groupBy]);
  });
  const rows = groups
    .map((g) => ({ [groupBy]: g.key, ...exposureStats(g.holdings) }))
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, args.limit ?? groups.length);
  return { groupBy, rows };
}

export interface TaxLotsArgs {
  cusip?: string;
  onlyLosses?: boolean;
  minLossAmount?: number;
  limit?: number;
}

export function taxLots(args: TaxLotsArgs = {}) {
  const p = loadPortfolio();
  const holdingsByCusip = new Map(p.holdings.map((h) => [h.cusip, h]));
  let rows = p.taxLots.map((lot) => {
    const h = holdingsByCusip.get(lot.cusip);
    return {
      ...lot,
      issuer: h?.issuer ?? lot.cusip,
      state: h?.state ?? null,
      revenueSector: h?.revenueSector ?? null,
      rating: h?.rating ?? null,
      yieldToWorst: h?.yieldToWorst ?? null,
      taxEquivalentYield: h?.taxEquivalentYield ?? null,
      unrealizedGainLossPct: round((lot.unrealizedGainLoss / lot.costBasis) * 100, 2),
    };
  });
  if (args.cusip) rows = rows.filter((r) => r.cusip === args.cusip);
  if (args.onlyLosses) rows = rows.filter((r) => r.unrealizedGainLoss < 0);
  if (args.minLossAmount != null) rows = rows.filter((r) => r.unrealizedGainLoss <= -Math.abs(args.minLossAmount!));
  rows.sort((a, b) => a.unrealizedGainLoss - b.unrealizedGainLoss);
  if (args.limit && args.limit > 0) rows = rows.slice(0, args.limit);
  return rows;
}

export interface RealizedGainsLossesArgs {
  year?: number;
}

export function realizedGainsLosses(args: RealizedGainsLossesArgs = {}) {
  const p = loadPortfolio();
  const year = args.year ?? new Date(p.asOf).getUTCFullYear();
  const trades = p.transactions
    .filter((t) => t.action === "Sell" && new Date(t.tradeDate).getUTCFullYear() === year)
    .map((t) => ({
      tradeDate: t.tradeDate,
      cusip: t.cusip,
      issuer: t.issuer,
      parValue: t.parValue,
      price: t.price,
      principal: t.principal,
      realizedGainLoss: t.realizedGainLoss,
      taxImpact: t.taxImpact,
      rationale: t.rationale,
    }));
  const realizedGainLoss = sum(trades, (t) => t.realizedGainLoss);
  const realizedGains = sum(trades.filter((t) => t.realizedGainLoss > 0), (t) => t.realizedGainLoss);
  const realizedLosses = sum(trades.filter((t) => t.realizedGainLoss < 0), (t) => t.realizedGainLoss);
  return {
    year,
    summary: {
      tradeCount: trades.length,
      realizedGains,
      realizedLosses,
      netRealizedGainLoss: realizedGainLoss,
      estimatedTaxImpact: sum(trades, (t) => t.taxImpact),
    },
    trades,
  };
}

export interface HarvestCandidatesArgs {
  minLossAmount?: number;
  minLossPercent?: number;
  limit?: number;
}

export function taxLossHarvestCandidates(args: HarvestCandidatesArgs = {}) {
  const minLossAmount = Math.abs(args.minLossAmount ?? 150000);
  const minLossPercent = Math.abs(args.minLossPercent ?? 3);
  return taxLots({ onlyLosses: true })
    .filter((lot) => Math.abs(lot.unrealizedGainLoss) >= minLossAmount || Math.abs(lot.unrealizedGainLossPct) >= minLossPercent)
    .sort((a, b) => a.unrealizedGainLoss - b.unrealizedGainLoss)
    .slice(0, args.limit ?? 12);
}

export interface TradeHistoryArgs {
  year?: number;
  action?: "Buy" | "Sell";
  cusip?: string;
  limit?: number;
}

export function tradeHistory(args: TradeHistoryArgs = {}) {
  const p = loadPortfolio();
  let rows = p.transactions.slice();
  if (args.year) rows = rows.filter((t) => new Date(t.tradeDate).getUTCFullYear() === args.year);
  if (args.action) rows = rows.filter((t) => t.action === args.action);
  if (args.cusip) rows = rows.filter((t) => t.cusip === args.cusip);
  rows.sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime());
  if (args.limit && args.limit > 0) rows = rows.slice(0, args.limit);
  return {
    summary: {
      tradeCount: rows.length,
      grossPrincipal: sum(rows, (t) => t.principal),
      commissions: sum(rows, (t) => t.commission),
      realizedGainLoss: sum(rows, (t) => t.realizedGainLoss),
      taxImpact: sum(rows, (t) => t.taxImpact),
    },
    trades: rows,
  };
}

export interface CallMaturityScheduleArgs {
  months?: number;
}

export function callMaturitySchedule(args: CallMaturityScheduleArgs = {}) {
  const p = loadPortfolio();
  const months = args.months ?? 18;
  const start = new Date(p.asOf);
  const end = addMonths(start, months);
  const events = p.holdings.flatMap((h) => {
    const rows: Array<Record<string, string | number | null>> = [];
    if (h.callable && h.callDate && isWithin(new Date(h.callDate), start, end)) {
      rows.push(scheduleEvent(h, "Call", h.callDate));
    }
    if (isWithin(new Date(h.maturityDate), start, end)) {
      rows.push(scheduleEvent(h, "Maturity", h.maturityDate));
    }
    return rows;
  });
  events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return {
    asOf: p.asOf,
    months,
    totalPrincipal: sum(events, (e) => Number(e.principal ?? 0)),
    events,
  };
}

export interface CashFlowProjectionArgs {
  months?: number;
  bucket?: "event" | "monthly" | "quarterly" | "annual";
}

export function cashFlowProjection(args: CashFlowProjectionArgs = {}) {
  const p = loadPortfolio();
  const months = args.months ?? 18;
  const bucket = args.bucket ?? "monthly";
  const start = new Date(p.asOf);
  const end = addMonths(start, months);
  const flows = p.cashFlows.filter((f) => isWithin(new Date(f.date), start, end));
  if (bucket === "event") {
    return {
      asOf: p.asOf,
      months,
      bucket,
      summary: cashFlowSummary(flows),
      rows: flows,
    };
  }
  const grouped = new Map<string, CashFlow[]>();
  for (const flow of flows) {
    const key = cashFlowBucketKey(flow.date, bucket);
    grouped.set(key, [...(grouped.get(key) ?? []), flow]);
  }
  const rows = [...grouped.entries()]
    .map(([period, periodFlows]) => ({
      period,
      interest: sum(periodFlows, (f) => f.interest),
      principal: sum(periodFlows, (f) => f.principal),
      totalCashFlow: sum(periodFlows, (f) => f.totalCashFlow),
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
  return {
    asOf: p.asOf,
    months,
    bucket,
    summary: cashFlowSummary(flows),
    rows,
  };
}

export interface PerformanceVsBenchmarkArgs {
  periods?: number;
}

export function performanceVsBenchmark(args: PerformanceVsBenchmarkArgs = {}) {
  const p = loadPortfolio();
  const periods = args.periods ?? 12;
  const history = p.performanceHistory.slice(-periods).map((row) => ({
    ...row,
    excessReturn: round(row.portfolioReturn - row.benchmarkReturn, 3),
  }));
  return {
    benchmark: p.benchmark.name,
    periods: history.length,
    summary: {
      portfolioReturn: round(compoundReturn(history.map((r) => r.portfolioReturn)), 3),
      benchmarkReturn: round(compoundReturn(history.map((r) => r.benchmarkReturn)), 3),
      excessReturn: round(compoundReturn(history.map((r) => r.portfolioReturn)) - compoundReturn(history.map((r) => r.benchmarkReturn)), 3),
      incomeReturn: round(sum(history, (r) => r.incomeReturn), 3),
      priceReturn: round(sum(history, (r) => r.priceReturn), 3),
    },
    history,
  };
}

export interface RateSpreadScenarioArgs {
  scenarioId?: string;
  rateShockBp?: number;
  spreadShockBp?: number;
  groupBy?: "revenueSector" | "state" | "rating" | "holding";
}

export function rateSpreadScenario(args: RateSpreadScenarioArgs = {}) {
  const p = loadPortfolio();
  const preset = p.riskScenarios.find((s) => s.id === args.scenarioId) ?? p.riskScenarios[0];
  const rateShockBp = args.rateShockBp ?? preset.rateShockBp;
  const spreadShockBp = args.spreadShockBp ?? preset.spreadShockBp;
  const groupBy = args.groupBy ?? "revenueSector";
  const shockedHoldings = p.holdings.map((h) => shockedHolding(h, rateShockBp, spreadShockBp));

  const rows =
    groupBy === "holding"
      ? shockedHoldings
          .map((h) => ({
            cusip: h.cusip,
            issuer: h.issuer,
            state: h.state,
            revenueSector: h.revenueSector,
            rating: h.rating,
            marketValue: h.marketValue,
            effectiveDuration: h.effectiveDuration,
            priceImpactPct: h.priceImpactPct,
            estimatedPnl: h.estimatedPnl,
          }))
          .sort((a, b) => a.estimatedPnl - b.estimatedPnl)
      : groupShockedHoldings(shockedHoldings, (h) => String(h[groupBy])).map((g) => ({
          [groupBy]: g.key,
          marketValue: sum(g.holdings, (h) => h.marketValue),
          weight: round((sum(g.holdings, (h) => h.marketValue) / p.totalMarketValue) * 100, 2),
          effectiveDuration: round(weightedAverage(g.holdings, (h) => h.effectiveDuration), 2),
          priceImpactPct: round(weightedAverage(g.holdings, (h) => h.priceImpactPct), 2),
          estimatedPnl: round(sum(g.holdings, (h) => h.estimatedPnl), 0),
        }));

  const totalPnl = sum(shockedHoldings, (h) => h.estimatedPnl);
  return {
    scenario: {
      id: args.scenarioId ?? preset.id,
      label:
        args.rateShockBp != null || args.spreadShockBp != null
          ? `${signedBp(rateShockBp)} bp rates / ${signedBp(spreadShockBp)} bp spreads`
          : preset.label,
      rateShockBp,
      spreadShockBp,
      groupBy,
    },
    summary: {
      marketValue: p.totalMarketValue,
      estimatedPnl: round(totalPnl, 0),
      priceImpactPct: round((totalPnl / p.totalMarketValue) * 100, 2),
    },
    rows,
  };
}

export function creditWatchlist() {
  const p = loadPortfolio();
  const holdingsByCusip = new Map(p.holdings.map((h) => [h.cusip, h]));
  return p.creditWatchlist.map((item) => {
    const h = holdingsByCusip.get(item.cusip);
    return {
      ...item,
      state: h?.state ?? null,
      revenueSector: h?.revenueSector ?? null,
      rating: h?.rating ?? null,
      marketValue: h?.marketValue ?? null,
      weight: h ? round(h.weight, 2) : null,
      yieldToWorst: h?.yieldToWorst ?? null,
      taxEquivalentYield: h?.taxEquivalentYield ?? null,
      liquidityScore: h?.liquidityScore ?? null,
      unrealizedGainLoss: h?.unrealizedGainLoss ?? null,
    };
  });
}

export function guidelineChecks() {
  const p = loadPortfolio();
  return p.guidelines.map((g) => {
    const actual = guidelineActual(g.metric);
    const headroom = g.operator === "max" ? g.limit - actual : actual - g.limit;
    const passed = headroom >= 0;
    return {
      id: g.id,
      guideline: g.name,
      severity: g.severity,
      metric: g.metric,
      operator: g.operator,
      limit: g.limit,
      actual: round(actual, 2),
      headroom: round(headroom, 2),
      status: passed ? "Pass" : g.severity === "Hard" ? "Fail" : "Watch",
    };
  });
}

export function yieldCurves() {
  const p = loadPortfolio();
  return p.yieldCurves;
}

function exposureRow(bucket: string, marketValue: number) {
  const p = loadPortfolio();
  return {
    bucket,
    marketValue,
    weight: round((marketValue / p.totalMarketValue) * 100, 2),
  };
}

function exposureStats(holdings: Holding[]) {
  const p = loadPortfolio();
  const marketValue = sum(holdings, (h) => h.marketValue);
  return {
    marketValue,
    weight: round((marketValue / p.totalMarketValue) * 100, 2),
    parValue: sum(holdings, (h) => h.parValue),
    weightedYieldToWorst: round(weightedAverage(holdings, (h) => h.yieldToWorst), 3),
    taxEquivalentYield: round(weightedAverage(holdings, (h) => h.taxEquivalentYield), 3),
    amtAdjustedTaxEquivalentYield: round(weightedAverage(holdings, (h) => h.amtAdjustedTaxEquivalentYield), 3),
    effectiveDuration: round(weightedAverage(holdings, (h) => h.effectiveDuration), 2),
    averageCoupon: round(weightedAverage(holdings, (h) => h.coupon), 3),
    averageLiquidityScore: round(weightedAverage(holdings, (h) => h.liquidityScore), 2),
    unrealizedGainLoss: sum(holdings, (h) => h.unrealizedGainLoss),
  };
}

function holdingRow(h: Holding) {
  return {
    ...h,
    federalTaxExempt: h.federalTaxExempt ? "Yes" : "No",
    stateTaxExempt: h.stateTaxExempt ? "Yes" : "No",
    amtFlag: h.amtFlag ? "Yes" : "No",
    insured: h.insured ? "Yes" : "No",
    callable: h.callable ? "Yes" : "No",
    weight: round(h.weight, 3),
    taxEquivalentYield: round(h.taxEquivalentYield, 3),
    amtAdjustedTaxEquivalentYield: round(h.amtAdjustedTaxEquivalentYield, 3),
    unrealizedGainLossPct: round((h.unrealizedGainLoss / h.costBasis) * 100, 2),
  };
}

function taxEquivalentYieldForHolding(h: RawHolding | Holding, p: RawPortfolio | Portfolio, useAmtAdjusted = false): number {
  if (!h.federalTaxExempt && !h.stateTaxExempt) return h.yieldToWorst;
  let applicableRate = 0;
  const amtRemovesFederalExemption = useAmtAdjusted && h.amtFlag && p.clientProfile.subjectToAMT;
  if (h.federalTaxExempt && !amtRemovesFederalExemption) applicableRate += p.clientProfile.federalTaxRate;
  if (h.stateTaxExempt) applicableRate += p.clientProfile.stateTaxRate;
  const denominator = 1 - applicableRate / 100;
  return denominator > 0 ? h.yieldToWorst / denominator : h.yieldToWorst;
}

function groupHoldings(key: (h: Holding) => string) {
  const p = loadPortfolio();
  const map = new Map<string, Holding[]>();
  for (const h of p.holdings) {
    const k = key(h);
    map.set(k, [...(map.get(k) ?? []), h]);
  }
  return [...map.entries()]
    .map(([k, holdings]) => ({ key: k, holdings }))
    .sort((a, b) => sum(b.holdings, (h) => h.marketValue) - sum(a.holdings, (h) => h.marketValue));
}

function groupShockedHoldings<T extends Holding & { estimatedPnl: number; priceImpactPct: number }>(
  holdings: T[],
  key: (h: T) => string,
) {
  const map = new Map<string, T[]>();
  for (const h of holdings) {
    const k = key(h);
    map.set(k, [...(map.get(k) ?? []), h]);
  }
  return [...map.entries()]
    .map(([k, grouped]) => ({ key: k, holdings: grouped }))
    .sort((a, b) => sum(a.holdings, (h) => h.estimatedPnl) - sum(b.holdings, (h) => h.estimatedPnl));
}

function sortableHoldingValue(h: Holding, key: NonNullable<ListHoldingsArgs["sortBy"]>): string | number | null {
  if (key === "maturityDate") return new Date(h.maturityDate).getTime();
  if (key === "callDate") return h.callDate ? new Date(h.callDate).getTime() : null;
  return h[key];
}

function compareNullable(a: string | number | null, b: string | number | null, dir: "asc" | "desc") {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const result = typeof a === "string" || typeof b === "string" ? String(a).localeCompare(String(b)) : a - b;
  return dir === "asc" ? result : -result;
}

function scheduleEvent(h: Holding, eventType: "Call" | "Maturity", date: string) {
  const p = loadPortfolio();
  const yearsToEvent = yearsBetween(new Date(p.asOf), new Date(date));
  return {
    date,
    eventType,
    cusip: h.cusip,
    issuer: h.issuer,
    state: h.state,
    revenueSector: h.revenueSector,
    rating: h.rating,
    principal: h.parValue,
    marketValue: h.marketValue,
    yieldToWorst: h.yieldToWorst,
    taxEquivalentYield: h.taxEquivalentYield,
    yearsToEvent: round(yearsToEvent, 2),
    reinvestmentRisk: h.yieldToWorst < portfolioSummary().weightedYieldToWorst ? "High" : "Moderate",
  };
}

function cashFlowSummary(flows: CashFlow[]) {
  return {
    interest: sum(flows, (f) => f.interest),
    principal: sum(flows, (f) => f.principal),
    totalCashFlow: sum(flows, (f) => f.totalCashFlow),
  };
}

function cashFlowBucketKey(date: string, bucket: "monthly" | "quarterly" | "annual") {
  const d = new Date(`${date}T00:00:00.000Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  if (bucket === "annual") return String(year);
  if (bucket === "quarterly") return `${year} Q${Math.ceil(month / 3)}`;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function compoundReturn(values: number[]) {
  return (values.reduce((acc, value) => acc * (1 + value / 100), 1) - 1) * 100;
}

function shockedHolding(h: Holding, rateShockBp: number, spreadShockBp: number) {
  const spreadDuration = h.effectiveDuration * 0.75;
  const rateImpactPct = -h.effectiveDuration * (rateShockBp / 100);
  const spreadImpactPct = -spreadDuration * (spreadShockBp / 100);
  const priceImpactPct = rateImpactPct + spreadImpactPct;
  return {
    ...h,
    priceImpactPct: round(priceImpactPct, 3),
    estimatedPnl: round(h.marketValue * (priceImpactPct / 100), 0),
  };
}

function guidelineActual(metric: Guideline["metric"]) {
  const p = loadPortfolio();
  switch (metric) {
    case "nyStateWeight":
      return sum(p.holdings.filter((h) => h.state === p.state), (h) => h.weight);
    case "nonNyWeight":
      return sum(p.holdings.filter((h) => h.state !== p.state), (h) => h.weight);
    case "singleIssuerWeight":
      return Math.max(...groupHoldings((h) => h.issuer).map((g) => sum(g.holdings, (h) => h.weight)));
    case "belowAWeight":
      return sum(p.holdings.filter((h) => ["BBB", "BB", "B"].includes(h.rating)), (h) => h.weight);
    case "amtWeight":
      return sum(p.holdings.filter((h) => h.amtFlag), (h) => h.weight);
    case "illiquidWeight":
      return sum(p.holdings.filter((h) => h.liquidityScore >= 4), (h) => h.weight);
    case "largestSectorWeight":
      return Math.max(...groupHoldings((h) => h.revenueSector).map((g) => sum(g.holdings, (h) => h.weight)));
  }
}

function weightedAverage<T extends { marketValue: number }>(rows: T[], value: (row: T) => number) {
  const mv = sum(rows, (row) => row.marketValue);
  if (!mv) return 0;
  return sum(rows, (row) => row.marketValue * value(row)) / mv;
}

function sum<T>(rows: T[], value: (row: T) => number) {
  return rows.reduce((acc, row) => acc + value(row), 0);
}

function yearsBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function isWithin(date: Date, start: Date, end: Date) {
  return date.getTime() > start.getTime() && date.getTime() <= end.getTime();
}

function signedBp(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function round(n: number, digits: number) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}
