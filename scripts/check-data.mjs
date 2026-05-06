import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "data", "portfolio.json");
const portfolio = JSON.parse(readFileSync(dataPath, "utf8"));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function sum(rows, field) {
  return rows.reduce((acc, row) => acc + Number(row[field] ?? 0), 0);
}

function isSortedByDate(rows, field) {
  for (let i = 1; i < rows.length; i += 1) {
    if (new Date(rows[i - 1][field]).getTime() > new Date(rows[i][field]).getTime()) {
      return false;
    }
  }
  return true;
}

const holdings = portfolio.holdings ?? [];
const cusips = new Set(holdings.map((holding) => holding.cusip));
const totalMarketValue = sum(holdings, "marketValue");
const computedWeight = holdings.reduce(
  (acc, holding) => acc + (holding.marketValue / portfolio.totalMarketValue) * 100,
  0,
);

check(holdings.length > 0, "portfolio has no holdings");
check(cusips.size === holdings.length, "holding CUSIPs must be unique");
check(
  Math.abs(totalMarketValue - portfolio.totalMarketValue) < 0.01,
  `holding market values (${totalMarketValue}) must reconcile to totalMarketValue (${portfolio.totalMarketValue})`,
);
check(Math.abs(computedWeight - 100) < 0.0001, `computed holding weights sum to ${computedWeight}, not 100`);

for (const holding of holdings) {
  const pricedMarketValue = (holding.parValue * holding.cleanPrice) / 100;
  check(
    Math.abs(pricedMarketValue - holding.marketValue) < 1,
    `${holding.cusip} marketValue does not match parValue * cleanPrice / 100`,
  );
  check(
    Math.abs(holding.marketValue - holding.costBasis - holding.unrealizedGainLoss) < 1,
    `${holding.cusip} unrealizedGainLoss does not match marketValue - costBasis`,
  );
  if (holding.callable) {
    check(Boolean(holding.callDate), `${holding.cusip} is callable but has no callDate`);
    check(Boolean(holding.callPrice), `${holding.cusip} is callable but has no callPrice`);
    check(
      new Date(holding.callDate).getTime() < new Date(holding.maturityDate).getTime(),
      `${holding.cusip} callDate must be before maturityDate`,
    );
  }
}

for (const lot of portfolio.taxLots ?? []) {
  check(cusips.has(lot.cusip), `tax lot ${lot.lotId} references unknown CUSIP ${lot.cusip}`);
  check(
    Math.abs(lot.marketValue - lot.costBasis - lot.unrealizedGainLoss) < 1,
    `tax lot ${lot.lotId} unrealizedGainLoss does not match marketValue - costBasis`,
  );
}

for (const trade of portfolio.transactions ?? []) {
  check(cusips.has(trade.cusip), `transaction ${trade.tradeDate} references unknown CUSIP ${trade.cusip}`);
}

for (const flow of portfolio.cashFlows ?? []) {
  check(!flow.cusip || cusips.has(flow.cusip), `cash flow ${flow.date} references unknown CUSIP ${flow.cusip}`);
  check(
    Math.abs(flow.interest + flow.principal - flow.totalCashFlow) < 1,
    `cash flow ${flow.date} totalCashFlow does not match interest + principal`,
  );
}

for (const item of portfolio.creditWatchlist ?? []) {
  check(cusips.has(item.cusip), `credit watch item references unknown CUSIP ${item.cusip}`);
}

check(isSortedByDate(portfolio.performanceHistory ?? [], "date"), "performanceHistory must be date-sorted ascending");
check(isSortedByDate(portfolio.transactions ?? [], "tradeDate"), "transactions must be date-sorted ascending");
check(isSortedByDate(portfolio.cashFlows ?? [], "date"), "cashFlows must be date-sorted ascending");
check((portfolio.riskScenarios ?? []).length > 0, "riskScenarios must not be empty");
check((portfolio.guidelines ?? []).length > 0, "guidelines must not be empty");

if (failures.length > 0) {
  console.error("Data consistency check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Data consistency check passed: ${holdings.length} holdings, ${portfolio.taxLots.length} tax lots, ${portfolio.transactions.length} transactions.`,
);
