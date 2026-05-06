# Project Description

## What This Is

Portfolio Agent is a chat-first municipal SMA portfolio demo for a synthetic NY taxable investor. A portfolio manager can ask natural-language questions like "Show a pie chart of the portfolio by state," "Show a bar chart of muni sectors," or "Which states have the highest yields?", and the app streams back live analyst activity plus inline charts, tables, and KPI cards.

The app is built with:

- Next.js App Router
- React client components
- Cursor TypeScript SDK
- A local Model Context Protocol (MCP) server
- Zod render schemas
- Recharts and TanStack Table
- Tailwind CSS v4

It is intentionally a demo of agentic generative UI: the agent calls tools, tool calls stream through the API, and the frontend turns validated render specs into rich inline UI.

## What It Is For

This project demonstrates how to build a Cursor SDK powered analyst workflow where:

- The LLM does not invent portfolio data.
- The LLM calls data tools to retrieve real numbers from a fixed data source.
- The LLM calls render tools to ask the UI to display structured results.
- The app streams intermediate activity so users can see what the agent is doing.
- The final answer feels like a polished portfolio management workspace, not a raw chatbot.

The portfolio is synthetic and bundled in the repo. This is not a production portfolio management system and does not connect to external market or holdings APIs.

## User Experience

The first screen is the workspace:

- Header with product identity, model status, and API-key status.
- Portfolio summary strip with market value, NY sourced weight, tax-equivalent yield, and duration.
- Empty-state prompt chips for muni SMA workflows such as TEY, tax lots, calls, trades, and shock scenarios.
- Chat prompt pinned at the bottom.
- Conversation area where user prompts, activity rows, charts, tables, and summaries appear inline.

The intended interaction model is:

1. User asks a portfolio question.
2. The server starts or reuses a Cursor SDK agent session.
3. The agent calls portfolio MCP tools.
4. The server streams normalized events to the browser.
5. The browser renders tool activity and validated UI components as they arrive.

## Data Model

The only portfolio data source is `data/portfolio.json`.

Important top-level fields:

- `asOf`
- `baseCurrency`
- `totalMarketValue`
- `holdings`
- `clientProfile`
- `taxRules`
- `benchmark`
- `yieldCurves`
- `performanceHistory`
- `transactions`
- `taxLots`
- `cashFlows`
- `riskScenarios`
- `creditWatchlist`
- `guidelines`

Each holding includes:

- `cusip`
- `issuer`
- `sector`
- `state`
- `issuerType`
- `revenueSector`
- `taxStatus`
- `amtFlag`
- `insured`
- `callDate`
- `callPrice`
- `parValue`
- `cleanPrice`
- `costBasis`
- `accruedInterest`
- `unrealizedGainLoss`
- `rating`
- `coupon`
- `maturityDate`
- `marketValue`
- `yieldToMaturity`
- `yieldToWorst`
- `effectiveDuration`
- `liquidityScore`
- `creditOutlook`

The `weight`, `taxEquivalentYield`, and `amtAdjustedTaxEquivalentYield` fields are computed in `src/lib/mcp/data.ts` from the bundled holdings and mock tax profile.

## MCP Tools

The MCP server lives at `src/lib/mcp/server.ts`. It registers two categories of tools.

### Data Tools

Defined in `src/lib/mcp/data-tools.ts` and implemented in `src/lib/mcp/data.ts`:

- `get_portfolio_summary`
- `list_holdings`
- `get_sector_allocation`
- `get_state_exposure`
- `get_muni_sector_exposure`
- `get_rating_distribution`
- `get_maturity_buckets`
- `get_duration_buckets`
- `get_tax_profile`
- `get_tax_equivalent_yield`
- `get_tax_lots`
- `get_tax_loss_harvest_candidates`
- `get_realized_gains_losses`
- `get_trade_history`
- `get_call_maturity_schedule`
- `get_cash_flow_projection`
- `get_performance_vs_benchmark`
- `run_rate_spread_scenario`
- `get_credit_watchlist`
- `get_guideline_checks`
- `get_yield_curves`

These return JSON for the agent to reason over and for render tools to display.

### Render Tools

Defined in `src/lib/mcp/render-tools.ts`, with schemas in `src/lib/render-schemas.ts`:

- `render_kpi_card`
- `render_data_grid`
- `render_bar_chart`
- `render_pie_chart`
- `render_line_chart`

Render tools do not directly draw UI inside MCP. They return an acknowledgement. The important part is that Cursor SDK emits the tool-call event with args, and the Next.js app intercepts that event to render the matching React component.

## Server Flow

The main streaming endpoint is `POST /api/chat` in `src/app/api/chat/route.ts`.

Request body:

```json
{
  "sessionId": "s_...",
  "message": "Show a pie chart of the portfolio by state."
}
```

The route calls `streamAgentResponse()` in `src/lib/agent/server.ts`.

That function:

1. Gets or creates a Cursor SDK agent for the session.
2. Sends the user request wrapped with the system prompt.
3. Emits a `session` event.
4. Iterates `run.stream()`.
5. Maps Cursor SDK messages to the app's SSE event union.
6. Waits for the run result.
7. Emits `done`.

Cancellation is handled by `POST /api/chat/cancel`, which calls `run.cancel()` for the active session run.

## Cursor SDK Agent Setup

`src/lib/agent/server.ts` creates the SDK agent with:

- `apiKey` from `process.env.CURSOR_API_KEY`
- `model` from `process.env.CURSOR_MODEL`, defaulting to `composer-2`
- local cwd set to `.workspace`
- one stdio MCP server named `portfolio`

Before dynamically importing `@cursor/sdk`, `src/lib/agent/network.ts` installs the corporate-network bootstrap:

- `CURSOR_USE_HTTP1=true` is required whenever `HTTP_PROXY` or `HTTPS_PROXY` is configured.
- Undici `EnvHttpProxyAgent` is registered so SDK `fetch()` calls honor `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`.
- `global-agent` is bootstrapped with the same standard proxy env vars so Node `http`/`https` request transports use the proxy.
- `NO_PROXY` is normalized to include `localhost,127.0.0.1,::1`.

The MCP server starts with:

```bash
node node_modules/tsx/dist/cli.mjs src/lib/mcp/server.ts
```

In code, that is launched as `process.execPath` plus the local `tsx/cli` entry, so runtime chat does not invoke `npx` or npm over the network.

The agent cwd is intentionally an empty `.workspace/` directory. The system prompt tells the agent not to edit files, run shell commands, or start dev servers. In this app, the agent should only answer by calling portfolio MCP tools.

## Streaming Events

The app-level stream type is `AgentStreamEvent` in `src/lib/types.ts`.

Important event types:

- `assistant_delta`: text chunks.
- `activity`: compact rows for data tools, lifecycle status, and tasks.
- `render`: validated render specs for inline UI.
- `error`: errors shown in the assistant message.
- `done`: final status.

The client parses SSE in `src/lib/stream/sse-client.ts`, then updates chat state in `src/components/chat/chat-panel.tsx`.

## Render Pipeline

The render pipeline has two validation layers:

1. Server-side validation in `src/lib/agent/server.ts` before emitting `render`.
2. Client-side validation in `src/components/render/render-block.tsx` before mounting a component.

This keeps malformed tool args from crashing the UI and makes render contracts explicit.

React renderers:

- KPI cards: `src/components/render/kpi-card.tsx`
- Data grids: `src/components/render/data-grid.tsx`
- Pie charts: `src/components/render/pie-chart.tsx`
- Bar charts: `src/components/render/bar-chart.tsx`
- Line charts: `src/components/render/line-chart.tsx`

Shared chart styling lives in `src/components/render/chart-shared.tsx`.

## Why MCP Event Normalization Exists

Cursor SDK tool calls may arrive as direct tool names or as wrapped MCP calls.

Direct shape:

```ts
event.name === "render_pie_chart"
event.args === { ...renderSpec }
```

Wrapped shape:

```ts
event.name === "mcp"
event.args.toolName === "render_pie_chart"
event.args.args === { ...renderSpec }
```

The frontend should not need to care about either shape. `src/lib/agent/server.ts` normalizes them so `activity.name` and `render.name` contain real tool names like `get_sector_allocation` or `render_pie_chart`.

## System Prompt Behavior

The system prompt in `src/lib/agent/system-prompt.ts` is central to the demo.

It instructs the model to:

- Act as a municipal SMA portfolio analyst for a NY taxable investor.
- Always call data tools before render tools.
- Prefer charts, tables, and KPI cards over prose.
- Avoid inventing numbers.
- Avoid process narration like "I am rendering a chart."
- Keep summaries short and PM-facing.
- Use the bundled mock tax profile and avoid tax-advice language.

If the demo starts producing noisy or tool-mechanical answers, check the prompt first and then the client-side text cleanup in `src/components/chat/chat-panel.tsx`.

## Styling

The visual design is dark, compact, and work-focused.

Theme tokens live in `src/app/globals.css`.

Tailwind v4 source directives are intentionally explicit:

```css
@source "../../src/app/*.tsx";
@source "../../src/components/chat/*.tsx";
@source "../../src/components/render/*.tsx";
@source "../../src/lib/*.ts";
@source "../../src/lib/*/*.ts";
@import "tailwindcss";
```

Do not casually collapse these into a recursive glob unless you verify the generated CSS. In this environment, recursive source scanning did not reliably emit utilities.

## Local Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and set CURSOR_API_KEY and PORTFOLIO_PASSWORD
npm run dev
```

Corporate proxy, VPN, or TLS-inspection profile:

```bash
CURSOR_USE_HTTP1=true
HTTPS_PROXY=http://proxy-host:port
HTTP_PROXY=http://proxy-host:port
NO_PROXY=localhost,127.0.0.1,::1
# If TLS inspection is enabled:
# NODE_EXTRA_CA_CERTS=/path/to/corporate-root-ca.pem
```

Open:

```text
http://localhost:3000
```

Useful prompts:

- "Show a pie chart of the portfolio by state."
- "Show a bar chart of muni sectors."
- "Show a pie chart of credit ratings."
- "Which states have the highest yields? Use a bar chart."
- "Show the 10 biggest bonds in a table."

## Verification

Basic checks:

```bash
npm run typecheck
npm run check:data
npm run build
npm run check
```

Suggested API smoke tests:

- State pie prompt should call `get_state_exposure` and emit `render_pie_chart`.
- Muni sector bar prompt should call `get_muni_sector_exposure` or `get_sector_allocation` and emit `render_bar_chart`.
- Credit rating pie prompt should call `get_rating_distribution` and emit `render_pie_chart`.
- Yield-by-state prompt should call `get_tax_equivalent_yield` and emit `render_bar_chart`.
- Biggest-bonds prompt should call `list_holdings` and emit `render_data_grid`.

Suggested browser checks:

- Desktop header and summary strip are aligned.
- Empty-state prompt chips are readable.
- Chart card and legend fit without overlap.
- Data grid scrolls horizontally on narrow screens.
- Prompt send button becomes stop button while streaming.
- Missing API key produces a visible inline error rather than fake data.
- Corporate-network failures explain whether to set `CURSOR_USE_HTTP1`, check `HTTP_PROXY`/`HTTPS_PROXY`, or provide `NODE_EXTRA_CA_CERTS`.

## Extension Ideas

Good next steps:

- Add more portfolio analytics tools, such as convexity, issuer concentration, and curve roll-down.
- Expand the performance and cash-flow history and improve `render_line_chart` use cases.
- Add a health endpoint with non-secret status: model id, data as-of date, and API-key configured boolean.
- Add focused tests for MCP data aggregation functions.
- Add ESLint once the project wants style checks beyond TypeScript.

Avoid by default:

- Upload/import flows.
- External portfolio APIs.
- Mock/fallback response modes.
- Broad dashboard-first redesigns.
- Secret persistence in browser local storage.
