import { readFileSync } from "node:fs";
import path from "node:path";

export type Sector = "Treasury" | "Agency" | "IG Corp" | "HY Corp" | "Muni" | "MBS";
export type Rating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B";

export interface Holding {
  cusip: string;
  issuer: string;
  sector: Sector;
  rating: Rating;
  coupon: number;
  maturityDate: string;
  marketValue: number;
  yieldToMaturity: number;
  duration: number;
  weight: number;
}

export interface Portfolio {
  asOf: string;
  baseCurrency: string;
  totalMarketValue: number;
  holdings: Holding[];
}

const DATA_PATH = path.resolve(process.cwd(), "data/portfolio.json");

let cache: Portfolio | null = null;

export function loadPortfolio(): Portfolio {
  if (cache) return cache;
  const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as Omit<Portfolio, "holdings"> & {
    holdings: Omit<Holding, "weight">[];
  };
  const total = raw.totalMarketValue;
  const holdings: Holding[] = raw.holdings.map((h) => ({
    ...h,
    weight: (h.marketValue / total) * 100,
  }));
  cache = { ...raw, holdings };
  return cache;
}

export function portfolioSummary() {
  const p = loadPortfolio();
  const totalMv = p.totalMarketValue;
  let weightedYtm = 0;
  let weightedDuration = 0;
  let weightedCoupon = 0;
  for (const h of p.holdings) {
    const w = h.marketValue / totalMv;
    weightedYtm += h.yieldToMaturity * w;
    weightedDuration += h.duration * w;
    weightedCoupon += h.coupon * w;
  }
  return {
    asOf: p.asOf,
    baseCurrency: p.baseCurrency,
    totalMarketValue: totalMv,
    holdingsCount: p.holdings.length,
    weightedYieldToMaturity: round(weightedYtm, 3),
    weightedDuration: round(weightedDuration, 2),
    weightedCoupon: round(weightedCoupon, 3),
  };
}

export function sectorAllocation() {
  return groupBy("sector").map((g) => ({
    sector: g.key,
    marketValue: g.mv,
    weight: round(g.weight, 2),
  }));
}

export function ratingDistribution() {
  const order: Rating[] = ["AAA", "AA", "A", "BBB", "BB", "B"];
  return groupBy("rating")
    .sort((a, b) => order.indexOf(a.key as Rating) - order.indexOf(b.key as Rating))
    .map((g) => ({ rating: g.key, marketValue: g.mv, weight: round(g.weight, 2) }));
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
    const inBucket = p.holdings.filter((h) => {
      const years = (new Date(h.maturityDate).getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000);
      return years >= b.min && years < b.max;
    });
    const mv = inBucket.reduce((s, h) => s + h.marketValue, 0);
    return {
      bucket: b.key,
      marketValue: mv,
      weight: round((mv / p.totalMarketValue) * 100, 2),
    };
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
    const inBucket = p.holdings.filter((h) => h.duration >= b.min && h.duration < b.max);
    const mv = inBucket.reduce((s, h) => s + h.marketValue, 0);
    return {
      bucket: b.key,
      marketValue: mv,
      weight: round((mv / p.totalMarketValue) * 100, 2),
    };
  });
}

export interface ListHoldingsArgs {
  sector?: Sector;
  rating?: Rating;
  minMaturityYears?: number;
  maxMaturityYears?: number;
  sortBy?: "marketValue" | "yieldToMaturity" | "duration" | "coupon" | "maturityDate" | "weight";
  sortDir?: "asc" | "desc";
  limit?: number;
}

export function listHoldings(args: ListHoldingsArgs = {}): Holding[] {
  const p = loadPortfolio();
  const now = new Date(p.asOf);
  let rows = p.holdings.slice();
  if (args.sector) rows = rows.filter((h) => h.sector === args.sector);
  if (args.rating) rows = rows.filter((h) => h.rating === args.rating);
  if (args.minMaturityYears != null || args.maxMaturityYears != null) {
    rows = rows.filter((h) => {
      const years = (new Date(h.maturityDate).getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (args.minMaturityYears != null && years < args.minMaturityYears) return false;
      if (args.maxMaturityYears != null && years > args.maxMaturityYears) return false;
      return true;
    });
  }
  const sortKey = args.sortBy ?? "marketValue";
  const dir = args.sortDir ?? "desc";
  rows.sort((a, b) => {
    const av = sortKey === "maturityDate" ? new Date(a.maturityDate).getTime() : (a as any)[sortKey];
    const bv = sortKey === "maturityDate" ? new Date(b.maturityDate).getTime() : (b as any)[sortKey];
    return dir === "asc" ? av - bv : bv - av;
  });
  if (args.limit && args.limit > 0) rows = rows.slice(0, args.limit);
  return rows.map((h) => ({ ...h, weight: round(h.weight, 3) }));
}

function groupBy(key: "sector" | "rating") {
  const p = loadPortfolio();
  const map = new Map<string, number>();
  for (const h of p.holdings) {
    const k = h[key];
    map.set(k, (map.get(k) ?? 0) + h.marketValue);
  }
  return [...map.entries()].map(([k, mv]) => ({
    key: k,
    mv,
    weight: (mv / p.totalMarketValue) * 100,
  }));
}

function round(n: number, digits: number) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}
