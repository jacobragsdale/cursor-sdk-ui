# Portfolio Agent

A chat-driven fixed-income portfolio dashboard powered by the [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript). Ask questions in natural language; the agent fetches data through a custom MCP server and renders charts, tables, and KPI cards inline as part of its response.

## Architecture

```
Browser  ──POST /api/chat──▶  Next.js route  ──▶  Cursor Agent (local)
                                                       │
                                                       │  stdio
                                                       ▼
                                              Portfolio MCP server
                                                       │
                                                       ▼
                                              data/portfolio.json
```

- **Data tools** (`get_portfolio_summary`, `list_holdings`, `get_sector_allocation`, …) return JSON for the agent to reason over.
- **Render tools** (`render_pie_chart`, `render_data_grid`, `render_bar_chart`, `render_line_chart`, `render_kpi_card`) take a UI spec as their args. The frontend intercepts the tool-call event in the SSE stream, validates the spec with Zod, and mounts the matching React component inline in the chat.
- The agent stays focused on planning + tool calls + summaries. The frontend stays focused on rendering React from validated specs.

## Setup

```bash
# 1. Install
npm install

# 2. Add your Cursor API key (from https://cursor.com/dashboard/integrations)
echo 'CURSOR_API_KEY=your-key-here' > .env.local

# 3. Run
npm run dev
```

Open http://localhost:3000 and try:

- "Show me the sector breakdown of the portfolio"
- "List the top 10 holdings by market value as a table"
- "What's our overall yield and duration?"
- "Compare AAA vs BBB exposure"
- "How is the maturity profile distributed?"

## Project layout

```
src/
├── app/
│   ├── api/chat/route.ts          # POST → SSE stream from agent
│   ├── api/chat/cancel/route.ts   # POST → run.cancel()
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── chat/                      # Panel, prompt input, message list, activity rows
│   └── render/                    # KPI, data grid, bar/pie/line charts + dispatcher
└── lib/
    ├── agent/                     # Cursor SDK agent lifecycle + system prompt
    ├── mcp/                       # MCP server + data tools + render tools + data accessor
    ├── stream/                    # SSE encode/decode helpers
    ├── render-schemas.ts          # Zod schemas for every render_* tool
    ├── types.ts                   # AgentStreamEvent + AssistantBlock + ChatMessage unions
    └── utils.ts                   # cn(), formatNumber()

data/portfolio.json                # ~40 dummy fixed-income holdings
.workspace/                        # Empty; the agent's cwd
references/                        # SDK docs + cookbook (not built)
```

## How it works

When you submit a prompt:

1. The browser opens an SSE connection to `/api/chat`.
2. The route handler retrieves (or creates) a `SDKAgent` for the session, prepends the system prompt, and calls `agent.send()`.
3. As `run.stream()` yields events, the route maps them to a typed `AgentStreamEvent`:
   - `assistant` text → `assistant_delta`
   - `thinking` → `thinking`
   - `tool_call` for a `render_*` tool → `render` (frontend mounts the component)
   - `tool_call` for a data tool / `status` / `task` → `activity` row
4. The browser parses each event and updates the conversation state, so charts and tables appear inline as the agent runs.

The agent's `cwd` points at an empty `.workspace/` directory and the system prompt forbids file edits and shell commands — it should only call MCP tools.
