# Plan 2 — What-if proposed-trades sandbox

## Goal
A side drawer where the PM stages hypothetical **sell** trades against the current book. Every existing portfolio data tool accepts a `view` argument so the agent (and the UI) can ask for `current`, `proposed`, or `delta`. The PM sees in-line how the proposed book would look — NY weight, duration, TEY, guideline status, sector concentration — before committing anything to an OMS.

## Decisions captured
- **Staging UX:** dedicated UI panel (drawer). No natural-language staging in v1 — keeps the audit trail clean and the data path obvious.
- **Tool integration:** every existing portfolio tool grows a `view: "current" | "proposed" | "delta"` argument. Tools apply the sandbox internally via one shared loader.
- **Trade scope:** sells + reinvest only. Proceeds become cash inside the proposed book. No buys, no new CUSIPs in v1.

## Data model

```ts
// src/lib/packs/portfolio/sandbox.ts
export interface StagedSell {
  id: string;            // nanoid
  cusip: string;
  parSold: number;       // 0 < parSold <= holding.parValue
  proceeds: number;      // derived; persisted so audit is reproducible
  accruedReleased: number;
  createdAt: string;     // ISO
  rationale?: string;    // free-text, optional
}

export interface SandboxState {
  sells: StagedSell[];
}
```

**Proceeds math** (computed at stage time, stored, never recomputed against drifting prices):
```
fraction         = parSold / holding.parValue
proceeds         = holding.marketValue * fraction
accruedReleased  = holding.accruedInterest * fraction
```

State scope: **per-session, server-canonical**. Lives in `Map<sessionId, SandboxState>` next to the existing session cache in `src/lib/agent/server.ts`. Mirrored to localStorage on the client as a cache-only optimization (server is source of truth on reload). Cleared on logout, but a future "save as scenario" can persist named copies.

## API endpoints

`src/app/api/sandbox/route.ts`:
- `GET /api/sandbox?sessionId=...` → `{ sells, summary }` where summary includes `cashRaised`, `weightDeltas` per sector/state/rating, `durationDelta`, `teyDelta`, `guidelineStatusBefore/After`.
- `POST /api/sandbox/sells` body `{ sessionId, cusip, parSold, rationale? }` → 201 with new `StagedSell`. Validates `parSold > 0` and `<= remaining par`.
- `DELETE /api/sandbox/sells/:id` body `{ sessionId }` → 204.
- `DELETE /api/sandbox` body `{ sessionId }` → clears all staged sells.

All endpoints require the existing auth cookie.

## Data-tool changes

### Shared loader — `src/lib/packs/portfolio/data.ts`

Introduce a single function the rest of `data.ts` uses to read holdings:

```ts
export interface LoadOptions {
  view?: "current" | "proposed";
  sandbox?: SandboxState;
}

export function loadHoldings(opts: LoadOptions = {}): Holding[] {
  const base = readPortfolio().holdings;
  if (opts.view !== "proposed" || !opts.sandbox) return base;
  return applySells(base, opts.sandbox.sells);
}
```

`applySells`:
1. For each sell, find the matching holding by CUSIP.
2. Scale `parValue`, `marketValue`, `accruedInterest`, `costBasis` by `(remaining / original)` par. Yields, duration, rating, dates stay unchanged.
3. If `parSold === parValue`, drop the holding entirely.
4. Append a single synthetic **Cash** row aggregating all proceeds:
   ```
   { cusip: "CASH", issuer: "Cash from staged sells", state: "—",
     revenueSector: "Cash", rating: null, marketValue: totalProceeds,
     yieldToWorst: 0, effectiveDuration: 0, ... }
   ```
   Cash row must be tolerated by every aggregation that groups by `state`, `revenueSector`, `rating`, `issuerType`, `taxStatus`. Treat null/"Cash" as its own group rather than crashing.

### Per-tool changes — `src/lib/packs/portfolio/tools.ts`

Each tool's `inputShape` gains:
```ts
view: z.enum(["current", "proposed", "delta"]).optional()
```

Each handler:
```ts
handler: async (args) => {
  const sandbox = getSandbox(currentSessionId());
  if (args.view === "delta") {
    const cur = portfolioSummary({ view: "current" });
    const prop = portfolioSummary({ view: "proposed", sandbox });
    return diff(cur, prop);
  }
  return portfolioSummary({ view: args.view ?? "current", sandbox });
}
```

`currentSessionId()` is the missing piece — MCP tools don't know the session. Two options:
- **A. Inject session via env when launching MCP.** `getOrCreateAgent` already spawns one MCP child per session; pass `PACKS_SESSION_ID` in `env`. Tool code reads `process.env.PACKS_SESSION_ID`. Simple.
- **B. Pass sessionId as an explicit arg.** More work for the agent; rejected.

Go with A.

### Delta shapes

For aggregations (state exposure, sector exposure, rating distribution): rows merged on the group key with `weight`, `marketValue`, `yieldToWorst`, `taxEquivalentYield`, `effectiveDuration` deltas. Net new groups (e.g., "Cash") appear with current=0.

For `list_holdings` and `get_tax_lots`: a sold-from-position appears once with `marketValueDelta`, `parDelta`. Fully closed positions surface explicitly with `status: "closed"`.

For `get_guideline_checks` and `get_credit_watchlist`: report current and proposed status per check; flag any check that flips pass → watch/fail.

## UI: side drawer

`src/components/sandbox/sandbox-drawer.tsx`:
- Toggle button in the header (next to model picker): "Sandbox · N trades".
- Drawer width 420px, slides from right.
- Header strip: "Cash raised $X · NY weight Δ · Duration Δ · TEY Δ · Guidelines: pass / watch / fail".
- "Add sell" form: typeahead CUSIP picker (powered by `list_holdings`), par slider (default = full par), proceeds preview, optional rationale.
- Staged sells list: each row shows issuer + state + sector + par + proceeds + remove button.
- Footer: "Clear all" and "Use proposed view by default in chat" toggle.

A small "View" pill in the chat header (Current / Proposed / Delta) lets the PM force a view; passed to the agent in the request body so the system prompt can include it.

## Agent integration — system prompt + addendum

Add to `PORTFOLIO_ADDENDUM` (`src/lib/packs/portfolio/prompt.ts`):

```
SANDBOX
  - Every portfolio tool accepts an optional `view: "current" | "proposed" | "delta"`.
  - When the PM has staged sells (you'll see a SANDBOX context block at the top
    of the user message), default to view: "proposed" unless they explicitly
    ask about the current book.
  - For comparisons ("how does this change duration?"), call the tool twice
    with view: "current" and view: "proposed" and render both, OR use
    view: "delta" when a single delta view is enough.
```

`buildPrompt()` (`src/lib/agent/system-prompt.ts:36`) gains a sandbox context section when the sandbox is non-empty:
```
SANDBOX CONTEXT
  Staged sells (3):
    - 64966MC95: $5,000,000 par (NY MTA, Transportation), proceeds $5,021,400
    - 414009A65: $2,000,000 par (HI GO, State GO), proceeds $1,982,300
    ...
  Cash raised: $X. Default view: proposed.
```

This keeps the agent grounded without forcing tool calls.

## Audit-trail interaction (meets Plan 6)

Every tool call records:
- `view` arg
- `sandboxHash` = sha256 of canonical-JSON `SandboxState` at call time
- `dataHash` of base portfolio.json (already in Plan 6)

Result: a proposed-view answer is fully reproducible from `(dataHash, sandboxHash, tool, args)`.

## Implementation phases

1. **Sandbox state module + API endpoints + auth.** No UI yet. Tested with curl.
2. **`loadHoldings` refactor.** Pure renaming: every helper in `data.ts` swaps `readPortfolio().holdings` for `loadHoldings()`. Unit tests for `applySells` (full sell, partial sell, multiple sells of same CUSIP, sell > par rejection, Cash row aggregation).
3. **Tool inputShape changes + session-id injection via MCP env.** Add `view` arg everywhere; default to current; reroute through `loadHoldings({ view, sandbox })`.
4. **Side drawer UI** + CUSIP picker + summary deltas + "use proposed by default" toggle.
5. **System-prompt + addendum updates** + sandbox-context injection in `buildPrompt`.
6. **Guideline-breach warnings** in the drawer header strip (red chip when proposed breaks a guideline that currently passes).

## Files touched
- `src/lib/packs/portfolio/data.ts` (loadHoldings, applySells, cash row, delta helpers)
- `src/lib/packs/portfolio/tools.ts` (view arg on every tool)
- `src/lib/packs/portfolio/sandbox.ts` (new)
- `src/lib/agent/server.ts` (pass `PACKS_SESSION_ID` env; expose `getSandbox`)
- `src/lib/mcp/server.ts` (read sessionId from env)
- `src/app/api/sandbox/route.ts` (new), `src/app/api/sandbox/sells/route.ts` (new), `src/app/api/sandbox/sells/[id]/route.ts` (new)
- `src/components/sandbox/sandbox-drawer.tsx` (new), `src/components/sandbox/cusip-picker.tsx` (new)
- `src/components/chat/chat-panel.tsx` (view pill, drawer toggle)
- `src/app/page.tsx` (drawer mount, header toggle)
- `src/lib/agent/system-prompt.ts` (sandbox context injection)
- `src/lib/packs/portfolio/prompt.ts` (SANDBOX addendum)

## Edge cases
- **Selling more par than held:** reject at API with 400. Surface as an error toast.
- **Partial fills of the same CUSIP across multiple staged sells:** allowed; cumulative par cannot exceed holding's par.
- **Duplicate stage of fully-closed position:** rejected because remaining par is zero.
- **Cash row in groupings:** every aggregator must treat unknown rating/sector/state as its own bucket. Add a unit test that runs every aggregator with a non-empty sandbox and asserts no exception.
- **Yield/duration of remaining piece:** unchanged. We do not attempt to model market impact.
- **Concurrent edits across tabs:** server is canonical; client polls `/api/sandbox` on focus and on each chat response.
- **Streaming during sandbox edits:** if a run is mid-flight when a sell is added, the in-flight run sees the old sandbox (snapshotted at agent.send() time). Subsequent runs see the new one. Document this.
- **Tax-loss harvest tool with view=proposed:** must include the realized loss the sell would produce. Acceptable: a v1.1 enrichment; for v1 the proposed view simply removes the position.

## Risks
- **Tool surface area doubles** in complexity once `view` is everywhere. Mitigate by centralizing in `loadHoldings`; tests cover the math once, not per-tool.
- **Agent may pick the wrong view.** Strong examples in the addendum and a "view" pill that lets the PM force the choice mitigate this.
- **MCP env injection requires restarting the MCP child** when the sandbox is reused for a new session-id; today we already cache one MCP per session, so this is consistent.

## Out of scope (v1)
- Buys of existing CUSIPs.
- New (hypothetical) bonds with hand-entered yield/duration.
- Trade execution / OMS / FIX.
- Multi-user shared scenarios.
- Named/saved scenarios with versioning.
- Market-impact modeling on the remaining piece.

## Success criteria
- A PM can stage a $5M sell of an MTA bond, immediately see `Cash raised $5.0M · Duration −0.21 · NY weight −0.7%`.
- "What's our duration after the trim?" calls the portfolio summary with `view: "proposed"` and reports a duration consistent with the drawer's header strip.
- Removing the staged sell returns every metric to its current value within one render cycle.
- Every proposed-view tool call recorded by Plan 6 carries the matching `sandboxHash`.
