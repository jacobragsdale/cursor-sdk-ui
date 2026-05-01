# Agent Handoff Guide

This repo is a Next.js demo app for a chat-first fixed-income portfolio analyst powered by the Cursor TypeScript SDK and a local MCP server. A new coding agent should be able to read this file, then `DESCRIBE.md`, and understand where to make changes without rediscovering the whole system.

## First Principles

- Keep the demo chat-first. Do not turn the first screen into a static dashboard or marketing landing page.
- Use the bundled portfolio only: `data/portfolio.json`.
- Use live Cursor SDK calls only. Do not add a deterministic fallback mode unless the user explicitly asks for one.
- Never commit real secrets. `.env.local` is ignored and should contain `CURSOR_API_KEY`.
- Keep render payloads schema-driven. Render tools produce specs, React components render validated specs.
- Preserve `/api/chat` as the primary streaming endpoint.

## Safety And Git

- `.env*` files are ignored, except `.env.example`.
- `.env.local` should never appear in `git status --short` except under ignored files.
- Before committing, run:

```bash
git check-ignore -v .env.local
git status --short --ignored
```

- `references/cookbook/` is ignored because it is a nested Git repo. Do not add it as a gitlink by accident.
- Generated/local folders that should stay out of Git: `node_modules/`, `.next/`, `.workspace/*` except `.workspace/.keep`, `next-env.d.ts`, and `*.tsbuildinfo`.

## Common Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run check
npm run build
```

`lint` and `check` currently both run TypeScript type checking. There is no ESLint config in this repo at the moment.

## Runtime Requirements

Create `.env.local` locally:

```bash
CURSOR_API_KEY=your-key-from-cursor-dashboard
```

Optional:

```bash
CURSOR_MODEL=composer-2
```

If `CURSOR_API_KEY` is missing, the UI should show a polished inline error. Do not silently fall back to fake data.

## Architecture Map

- `src/app/page.tsx`
  - Server component shell.
  - Reads the bundled portfolio summary and renders the header summary strip.
  - Passes `apiKeyConfigured` into the chat client.

- `src/components/chat/*`
  - Client-side conversation state, prompt input, message rendering, activity rows.
  - `chat-panel.tsx` sends POST requests to `/api/chat`, parses SSE events, groups adjacent KPI cards, and filters obvious process narration.

- `src/components/render/*`
  - Inline UI blocks for render tool specs: KPI cards, data grid, bar chart, pie chart, line chart.
  - `render-block.tsx` validates unknown args again on the client using Zod before rendering.

- `src/lib/agent/server.ts`
  - Cursor SDK agent lifecycle.
  - Per-session agent cache and active run registry.
  - Maps Cursor SDK stream events into the app's `AgentStreamEvent` union.
  - Normalizes MCP-wrapped tool calls, especially `event.name === "mcp"` with `event.args.toolName`.
  - Validates `render_*` MCP args before emitting `render` events.

- `src/lib/agent/system-prompt.ts`
  - Agent operating instructions.
  - Keep this strict: call data tools before render tools, avoid process narration, do not edit files or run shell commands.

- `src/lib/mcp/*`
  - Local stdio MCP server and tool registrations.
  - Data tools read from `data/portfolio.json`.
  - Render tools acknowledge render specs so the frontend can intercept tool calls and mount React components.

- `src/lib/render-schemas.ts`
  - Source of truth for render tool names and Zod specs.
  - Update this before changing render tool contracts.

- `src/lib/types.ts`
  - SSE event union and chat block types shared by server and client.

- `src/lib/stream/*`
  - SSE server/client helpers.

- `src/app/globals.css`
  - Tailwind v4 setup and theme tokens.
  - Important: source directives are explicit because recursive source scanning was unreliable in this environment.

## Streaming Contract

The server emits `AgentStreamEvent` objects over SSE:

- `session`: run/session ids.
- `assistant_delta`: text streamed from the agent.
- `thinking`: hidden behind a compact analysis activity treatment in the UI.
- `activity`: status, task, and data tool lifecycle rows.
- `render`: validated render specs for `render_kpi_card`, `render_data_grid`, `render_bar_chart`, `render_pie_chart`, or `render_line_chart`.
- `error`: polished error text.
- `done`: final run status.

When adding a new render tool:

1. Add the Zod schema and tool name in `src/lib/render-schemas.ts`.
2. Register it in `src/lib/mcp/render-tools.ts`.
3. Add a React renderer in `src/components/render/`.
4. Route it in `src/components/render/render-block.tsx`.
5. Update `AgentStreamEvent` if the tool name union changes.
6. Update the system prompt with when to use it.

## MCP Tool Event Normalization

Cursor SDK tool events can arrive in two shapes:

- Direct: `event.name === "render_pie_chart"` and `event.args` is the render spec.
- Wrapped MCP: `event.name === "mcp"`, `event.args.toolName === "render_pie_chart"`, and `event.args.args` is the render spec.

`src/lib/agent/server.ts` normalizes both so the frontend only sees the real tool name. Preserve this behavior.

## UI And Design Notes

- The app should feel like a portfolio manager's analyst workspace: compact, precise, and information-dense.
- Avoid decorative hero sections. The chat workspace is the product.
- Keep cards practical and low-radius. Current render cards use `rounded-lg`.
- Use lucide icons where icons are needed.
- Charts should be visible in both desktop and narrow browser widths.
- Tables should be horizontally scrollable rather than squeezed into unreadable columns.
- Text should not overlap or spill out of buttons/cards.

## Verification Checklist

For code changes, run at least:

```bash
npm run typecheck
npm run build
```

For UI or streaming changes, also smoke test `/api/chat` with:

- `Show me the sector breakdown` should emit `render_pie_chart`.
- `List the top 10 holdings by market value` should emit `render_data_grid` with 10 rows.
- `What's our overall yield and duration?` should emit KPI cards.

For browser verification:

- Desktop layout should not be top-left stacked.
- Narrow viewport should keep header, summary strip, chart, legend, and prompt usable.
- Prompt send and stop buttons should switch state while streaming.
- Missing or invalid `CURSOR_API_KEY` should show a clear inline error.

## Known Quirks

- The Cursor model may still produce occasional prose. The client filters obvious process narration, but the system prompt is the first line of defense.
- `references/sdk-typescript.md` is checked in as local SDK reference material.
- `references/cookbook/` exists locally but is ignored because it is a nested Git repo.
- The app uses `npx -y tsx src/lib/mcp/server.ts` for the MCP stdio server. If startup breaks, check Node/npm availability and the MCP entry path first.
