import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, isValidAuthToken } from "@/lib/auth";
import { login } from "@/lib/auth-actions";

interface LoginPageProps {
  searchParams?: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  if (isValidAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
    redirect("/");
  }

  const params = await searchParams;
  const hasError = params?.error === "1";

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bg)] px-4 py-10">
      <section className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl shadow-black/30">
        <div className="mb-6">
          <div className="mb-4 grid size-10 place-items-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/12 text-sm font-semibold text-[var(--color-accent)]">
            FI
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-fg)]">
            Portfolio Agent
          </h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Enter the workspace password to continue.
          </p>
        </div>

        <form action={login} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-fg-dim)]"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              className="h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-fg)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
            />
          </div>

          {hasError ? (
            <p className="rounded-md border border-[var(--color-negative)]/30 bg-[var(--color-negative)]/10 px-3 py-2 text-sm text-[var(--color-negative)]">
              Password not recognized.
            </p>
          ) : null}

          <button
            type="submit"
            className="h-11 w-full rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-[#06110f] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/35"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
