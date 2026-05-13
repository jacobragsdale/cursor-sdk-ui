import { ChatPanel } from "@/components/chat/chat-panel";
import { ModelPicker } from "@/components/chat/model-picker";
import { ModelProvider } from "@/components/chat/model-provider";
import { appConfig } from "@/app.config";
import { DEFAULT_MODEL_ID, listModels } from "@/lib/agent/server";
import { AUTH_COOKIE_NAME, isValidAuthToken } from "@/lib/auth";
import { logout } from "@/lib/auth-actions";
import { enabledPacks } from "@/packs.config";
import type { PackHeaderSummary, SamplePrompt } from "@/lib/packs/types";

const MAX_SAMPLE_PROMPTS = 8;
import type { ModelListItem } from "@cursor/sdk";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  if (!isValidAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
    redirect("/login");
  }

  const header = await loadHeaderSummary();
  const samplePrompts: SamplePrompt[] = enabledPacks
    .flatMap((p) => p.samplePrompts)
    .slice(0, MAX_SAMPLE_PROMPTS);
  const apiKeyConfigured = Boolean(process.env.CURSOR_API_KEY);
  let initialModels: ModelListItem[] = [];
  let initialModelsError: string | undefined;
  if (apiKeyConfigured) {
    try {
      initialModels = await listModels();
    } catch (err) {
      initialModelsError = err instanceof Error ? err.message : String(err);
    }
  }
  const asOf = header?.asOf
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${header.asOf}T00:00:00.000Z`))
    : null;

  return (
    <ModelProvider
      apiKeyConfigured={apiKeyConfigured}
      initialModels={initialModels}
      initialModelsError={initialModelsError}
      defaultModelId={DEFAULT_MODEL_ID}
    >
      <main className="flex h-screen flex-col bg-[var(--color-bg)]">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/12 text-sm font-semibold text-[var(--color-accent)]">
                  {appConfig.accentInitials}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold tracking-tight">
                    {appConfig.appName}
                  </div>
                  <div className="truncate text-[11px] text-[var(--color-fg-dim)]">
                    {appConfig.subtitle}
                    {asOf ? ` · data as of ${asOf}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <ModelPicker />
                <span
                  className={
                    apiKeyConfigured
                      ? "rounded-full border border-[var(--color-positive)]/30 bg-[var(--color-positive)]/10 px-2.5 py-1 text-[var(--color-positive)]"
                      : "rounded-full border border-[var(--color-negative)]/30 bg-[var(--color-negative)]/10 px-2.5 py-1 text-[var(--color-negative)]"
                  }
                >
                  {apiKeyConfigured ? "Live SDK connected" : "API key missing"}
                </span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
            {header && header.metrics.length > 0 && (
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {header.metrics.map((m) => (
                  <SummaryMetric key={m.label} label={m.label} value={m.value} />
                ))}
              </dl>
            )}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatPanel apiKeyConfigured={apiKeyConfigured} samplePrompts={samplePrompts} />
        </div>
      </main>
    </ModelProvider>
  );
}

async function loadHeaderSummary(): Promise<PackHeaderSummary | null> {
  const pack = enabledPacks[0];
  if (!pack?.headerSummary) return null;
  return await pack.headerSummary();
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-fg-dim)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}
