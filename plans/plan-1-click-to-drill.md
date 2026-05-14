# Plan 1 — Click-to-drill on rendered blocks

## Goal
Turn every rendered chart, table, and KPI card into an entry point for the next analytical question. A click on a slice, row, KPI, or series line populates the prompt input with a suggested follow-up that the PM can review, edit, and send.

## Decisions captured
- **Click action:** populate the prompt input (no auto-send). PM stays in control; safer for a real PM workflow.
- **Drill source:** the agent declares drill intents per-render as part of the render spec. Maximum flexibility; agent picks the right next question given the data it just fetched.
- **Scope:** all five render blocks support drill (KPI, data grid, bar, pie, line).

## User-facing behavior
- Hovering a drillable element shows a cursor change plus a small tooltip with the suggested prompt.
- Clicking populates the existing `PromptInput` with that prompt and focuses the textarea. Nothing is sent.
- If the element has no drill prompt the cursor stays default and clicks do nothing.

## Schema changes — `src/lib/render-schemas.ts`

Use a single, consistent convention: an optional `__drillPrompt: string` field at the leaf the user can click. The double-underscore prefix keeps it out of the data namespace and is easy to filter out of chart axes / grid columns.

- `KpiCardSpec`: add `drillPrompt?: string` at the top level (one drill per card).
- Chart datum (`chartDatum` in `render-schemas.ts:31`): allow `__drillPrompt?: string` per row.
  - Pie: per-slice (one datum = one slice).
  - Bar: per-bar (one datum = one bar).
  - Line: per-series via `LineSeries.drillPrompt?: string`.
- `DataGridSpec`: rows may carry `__drillPrompt`; if present, the entire row is clickable. Grid filtering already passes unknown keys through, so this is forward-compatible.

Validation: `__drillPrompt` capped at 240 chars to avoid bloating the input. Trim whitespace.

## Frontend changes

### 1. Lift prompt-input value into chat-panel
Today `PromptInput` (`src/components/chat/prompt-input.tsx`) is uncontrolled. Convert it to a controlled component with `value` / `onChange` props, owned by `ChatPanel`. Expose a `populatePrompt(text)` callback through React context (`DrillContext`).

`ChatPanel` provides:
```ts
interface DrillContextValue {
  populatePrompt: (text: string) => void;
}
```

### 2. Render-block wiring
Each block reads `__drillPrompt` from its data and calls `useDrill().populatePrompt(prompt)` on click.

- `pie-chart.tsx`: Recharts `<Pie onClick={(data) => ...}>` — `data.payload.__drillPrompt`.
- `bar-chart.tsx`: `<Bar onClick={(data) => ...}>` likewise.
- `data-grid.tsx`: row-level `onClick`; set `cursor-pointer` on rows that have `__drillPrompt`.
- `line-chart.tsx`: legend `<Legend onClick>` reading the series spec.
- `kpi-card.tsx`: wrap card body in a button when `drillPrompt` is set.

In all five, filter `__drillPrompt` out of any user-visible projection (labels, tooltips, exported values).

### 3. Hover affordance
Shared CSS in `chart-shared.tsx`: `.drillable { cursor: pointer; transition: opacity 0.15s; } .drillable:hover { opacity: 0.85; }`. Tooltip uses the existing recharts tooltip plus an appended "Click to ask: …".

## Agent changes — `src/lib/agent/system-prompt.ts`

Add a new section after the existing render-tool description:

```
DRILL PROMPTS
  - Every render tool accepts optional drill prompts on its data points or rows.
  - Set them when a natural follow-up exists. Don't force them.
  - Drill prompts are populated into the user's input box; the user reviews
    before sending. Phrase them as short, complete questions ("Show holdings
    in Transportation", not "transportation holdings").
  - Examples:
      pie of state exposure → each datum.__drillPrompt = `Show holdings in ${state}`
      grid of watchlist names → each row.__drillPrompt = `Run a 100bp shock on ${cusip}`
      KPI: NY weight → drillPrompt = "Show NY vs out-of-state breakdown"
```

Also update `src/lib/packs/portfolio/prompt.ts` PORTFOLIO_EXAMPLES to include one drill-aware example.

## MCP render-tool descriptions — `src/lib/mcp/render-tools.ts`

Append a single sentence to each description explaining the drill field, so the agent sees the documentation through the MCP schema as well. This is what the SDK actually grounds against.

## Implementation phases

1. **Plumbing** — controlled PromptInput, DrillContext, populatePrompt callback. No behavior change yet.
2. **Schemas** — add `__drillPrompt` / `drillPrompt` to all render specs and chartDatum, plus length cap.
3. **Component wiring** — KPI → data grid → pie → bar → line, one PR each so regressions are isolated.
4. **Prompts** — update system prompt and the portfolio pack addendum with examples.
5. **Telemetry hook** — emit a lightweight `drill_clicked` activity event (kind: "status") so we can later measure usage. Optional but easy.

## Files touched
- `src/lib/render-schemas.ts` (schemas)
- `src/lib/mcp/render-tools.ts` (descriptions)
- `src/lib/agent/system-prompt.ts` (DRILL PROMPTS section)
- `src/lib/packs/portfolio/prompt.ts` (one new example)
- `src/components/chat/chat-panel.tsx` (lift prompt state, provide DrillContext)
- `src/components/chat/prompt-input.tsx` (controlled component)
- `src/components/render/render-block.tsx` (wrap with DrillContext consumer; pass-through)
- `src/components/render/{kpi-card,data-grid,pie-chart,bar-chart,line-chart}.tsx`
- `src/components/render/chart-shared.tsx` (drillable styles)

## Edge cases
- Empty / whitespace-only drill prompt: schema rejects via `.min(1)`.
- Drill prompt that exceeds the prompt-input max length: truncate with ellipsis when populating; show full in hover tooltip.
- Streaming: if the agent updates a render mid-stream (`appendOrUpdateRender` in `chat-panel.tsx:390`), drill prompts can change between renders. Acceptable.
- Mobile / touch: hover tooltip won't appear; first tap should show a small popover with the prompt and a "Use this prompt" button rather than populating directly. Worth a v1.1 follow-up.
- Conflicting clicks: if a bar's slice and the chart background both have handlers, the slice wins (stopPropagation in the per-datum onClick).

## Risks
- **Agent inconsistency.** Without strong examples the agent may either over-populate drills (every cell) or skip them entirely. Mitigation: 2–3 explicit examples in the system prompt; consider adding a soft post-validation that strips drill prompts on KPI cards when no clear follow-up exists.
- **Recharts onClick contract** differs subtly between Pie, Bar, and Line. Plan for one branch per component during phase 3 rather than a generic helper.

## Out of scope (v1)
- Auto-send drills.
- Drill history / breadcrumb navigation.
- Drill chains generated entirely by the frontend without agent involvement.
- Right-click context menus.

## Success criteria
- Clicking the NY slice on the state-exposure pie populates the input with "Show holdings in NY" and focuses the textarea.
- Clicking a row in the tax-loss harvest grid populates a CUSIP-specific follow-up.
- Type-check passes; no regressions in the existing render demos.
