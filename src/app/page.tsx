import { ChatPanel } from "@/components/chat/chat-panel";
import { portfolioSummary } from "@/lib/mcp/data";
import { formatNumber } from "@/lib/utils";

const MODEL_ID = process.env.CURSOR_MODEL ?? "composer-2";

export const dynamic = "force-dynamic";

export default function Page() {
  const summary = portfolioSummary();
  const apiKeyConfigured = Boolean(process.env.CURSOR_API_KEY);
  const asOf = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${summary.asOf}T00:00:00.000Z`));

  return (
    <main className="flex h-screen flex-col bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/12 text-sm font-semibold text-[var(--color-accent)]">
                FI
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold tracking-tight">
                  Fixed-Income Portfolio Agent
                </div>
                <div className="truncate text-[11px] text-[var(--color-fg-dim)]">
                  Portfolio management workspace · data as of {asOf}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[var(--color-fg-muted)]">
                {MODEL_ID}
              </span>
              <span
                className={
                  apiKeyConfigured
                    ? "rounded-full border border-[var(--color-positive)]/30 bg-[var(--color-positive)]/10 px-2.5 py-1 text-[var(--color-positive)]"
                    : "rounded-full border border-[var(--color-negative)]/30 bg-[var(--color-negative)]/10 px-2.5 py-1 text-[var(--color-negative)]"
                }
              >
                {apiKeyConfigured ? "Live SDK connected" : "API key missing"}
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryMetric label="Market value" value={formatNumber(summary.totalMarketValue, "currency")} />
            <SummaryMetric label="Holdings" value={formatNumber(summary.holdingsCount, "number", 0)} />
            <SummaryMetric label="YTM" value={formatNumber(summary.weightedYieldToMaturity, "percent", 2)} />
            <SummaryMetric label="Duration" value={formatNumber(summary.weightedDuration, "decimal", 2)} />
          </dl>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatPanel apiKeyConfigured={apiKeyConfigured} />
      </div>
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-fg-dim)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}
