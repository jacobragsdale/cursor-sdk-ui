# Plan 6 — Source citations & audit log

## Goal
Every rendered chart, table, and KPI carries a visible **citation chip** ("data from `get_state_exposure({groupBy:'state'})` · 142ms · data `sha256:7e9a…`"), and a per-session JSONL **audit log** captures everything required to reproduce the answer later.

If a PM trades on a number that came out of this app, we must be able to answer:
> "That number came from tool `X` with args `Y`, executed against portfolio snapshot `sha256:…` at timestamp `Z`. Re-running with the same snapshot and args produces a result whose sha256 matches the one we recorded — here it is."

That is the bar this plan is held to.

## Decisions captured
- **Depth:** full persisted log + UI chips. Trust in the moment, defensible after the fact.
- **Reproducibility:** snapshot the data files at session start and record `(data_hash, tool, args, result_hash)` for every call. Re-execution must reproduce the same `result_hash`.
- **Storage:** file-system JSONL per session at `.audit/<sessionId>.jsonl`. Snapshots stored once, by content hash, under `.audit/snapshots/<sha256>.json`.

## Event model

One JSON object per line in `.audit/<sessionId>.jsonl`:

```ts
// src/lib/audit/types.ts
type AuditEvent =
  | SessionStart
  | UserMessage
  | ToolCall
  | ToolResult
  | Render
  | AssistantText
  | RunDone
  | Error;

interface Base { ts: string; sessionId: string; }

interface SessionStart extends Base {
  type: "session_start";
  userId?: string;        // from auth cookie when available
  model: string;          // CURSOR_MODEL or selected
  agentVersion: string;   // @cursor/sdk version + app version
  packs: Array<{ id: string; version?: string }>;
  dataSnapshots: Array<{ pack: string; path: string; sha256: string; asOf?: string; bytes: number }>;
}

interface UserMessage extends Base { type: "user_message"; runId: string; text: string; }

interface ToolCall extends Base {
  type: "tool_call";
  runId: string;
  callId: string;
  tool: string;            // prefixed name, e.g. "portfolio__get_state_exposure"
  args: unknown;           // exact args sent
  argsHash: string;        // sha256(canonical JSON of args)
  view?: string;           // ties to Plan 2
  sandboxHash?: string;    // ties to Plan 2
}

interface ToolResult extends Base {
  type: "tool_result";
  runId: string;
  callId: string;
  tool: string;
  resultHash: string;      // sha256(canonical JSON of result)
  resultBytes: number;
  durationMs: number;
  resultRefPath?: string;  // for results > N KB, full payload spilled to .audit/payloads/<hash>.json
  error?: string;
}

interface Render extends Base {
  type: "render";
  runId: string;
  callId: string;          // the render tool call id
  name: "render_kpi_card" | "render_data_grid" | "render_bar_chart" | "render_pie_chart" | "render_line_chart";
  specHash: string;        // sha256(canonical JSON of validated spec)
  sourceCallId?: string;   // callId of the producing data tool, if known
  sourceConfidence: "explicit" | "inferred" | "none";
}

interface AssistantText extends Base { type: "assistant_text"; runId: string; textHash: string; text: string; }

interface RunDone extends Base { type: "run_done"; runId: string; status: "finished" | "cancelled" | "error"; durationMs: number; }

interface ErrorEvent extends Base { type: "error"; runId?: string; message: string; stack?: string; }
```

Canonical JSON = recursive key-sorted JSON.stringify with stable number formatting. Required for stable hashes.

## Snapshot strategy

Goal: a data tool's result is reproducible from `(snapshot_sha256, tool, args, sandboxHash?)`.

1. Each `Pack` declares the files it reads:
   ```ts
   // src/lib/packs/types.ts
   interface Pack {
     // ...
     dataFiles?: string[];   // paths relative to repo root
   }
   ```
   `portfolioPack` lists `["data/portfolio.json"]`.

2. On `getOrCreateAgent` (`src/lib/agent/server.ts:48`), for each enabled pack read each file, compute sha256, and:
   - If `.audit/snapshots/<sha256>.json` does not exist, write the file content there.
   - Record `{ pack, path, sha256, bytes, asOf }` in the `session_start` event. `asOf` is pulled from `data.asOf` for the portfolio pack; packs can override.

3. Refuse to start the session if a declared file is missing or unreadable.

4. The pack data layer always reads from the snapshot path it was issued at session start — not the live file. This guarantees the entire session sees one frozen snapshot even if `data/portfolio.json` is edited mid-session. Implementation: `loadHoldings` reads from `process.env.PACKS_SNAPSHOT_PATH` (injected at MCP spawn, alongside `PACKS_SESSION_ID` from Plan 2). Falls back to the live file when no snapshot path is set (dev convenience).

## Source-call inference

A render needs to point at the data tool that produced its data. Two strategies, in priority order:

1. **Explicit.** Add a top-level `sourceCallId?: string` to every render spec in `src/lib/render-schemas.ts`. Teach the agent (system prompt + one example) to pass the producing tool's callId. When present, `sourceConfidence = "explicit"`.
2. **Inferred.** If absent, link to the most recent **completed** data-tool call in the same run that occurred before the render's args were finalized. `sourceConfidence = "inferred"`.
3. **None.** If no data-tool call has run in this run yet, set `sourceCallId = null` and `sourceConfidence = "none"`. UI surfaces a warning chip ("no live source — answer not grounded").

Inference happens in `forwardSdkMessage` (`src/lib/agent/server.ts:133`) inside the render-validation branch. Track the last completed data-tool callId in a `Map<runId, string>`.

## Storage layout

```
.audit/
  snapshots/
    <sha256>.json           # frozen copy of data files, content-addressed
  payloads/
    <sha256>.json           # spilled tool results > 64 KB
  s_xxxxxxxxxx.jsonl        # one file per session, append-only
```

- `.audit/` is gitignored. Snapshots dedupe across sessions automatically.
- JSONL append uses `fs.createWriteStream(path, { flags: "a" })`. One stream per session, cached in module scope, flushed on `RunDone`.
- **Fail-loud:** if an audit write throws, the SSE response emits an `error` event and aborts the run. An un-audited answer must not reach a PM who might act on it.

## API & UI

### Server-side
- `GET /api/audit/:sessionId` — streams the JSONL file as `application/x-ndjson`. Requires auth cookie. Future enhancement: filter by run.
- `GET /api/audit/:sessionId/bundle` — streams a zip of `<session>.jsonl` plus referenced snapshot(s) and any spilled payloads. This is the audit pack.

### Client-side
- Add `sourceCallId`, `sourceConfidence`, `dataSnapshot: { sha256, asOf }` to the `render` event in `AgentStreamEvent` (`src/lib/types.ts`).
- New `<CitationChip>` rendered alongside every `RenderBlock`:
  - Compact: "from `get_state_exposure` · `7e9a…` · 142 ms".
  - Click: expandable panel showing tool name, full args JSON, view/sandboxHash, snapshot sha256 + asOf, result hash, duration, callId. Includes a "Copy citation" button.
  - Warning style when `sourceConfidence === "none"`.
- Header link "Download audit bundle" calls `/api/audit/:sessionId/bundle`.

## Replay verifier

Ship a CLI script so we can prove the reproducibility claim:

`scripts/replay-audit.mjs <sessionId>`:
1. Read `.audit/<sessionId>.jsonl`.
2. Reconstruct the pack snapshot paths from `session_start`.
3. For each `tool_call` event:
   - Spawn the MCP server with `PACKS_SNAPSHOT_PATH` pointing at the snapshot.
   - Call the tool with the recorded args.
   - Canonical-JSON-hash the result.
   - Compare to the recorded `resultHash`.
4. Report any mismatches as errors. Exit non-zero on any failure.

This is the proof. If it passes against a session, the citations from that session are defensible.

Add `npm run replay -- <sessionId>` to `package.json`.

## Implementation phases

1. **Audit module skeleton** — `src/lib/audit/{types,writer,hash}.ts`. Per-session writer cache, canonical-JSON hash helper, payload spill. No SDK integration yet; unit-tested in isolation.
2. **Pack snapshots** — `Pack.dataFiles`, snapshot writer, `.audit/snapshots/` content-addressed store, `PACKS_SNAPSHOT_PATH` env wiring. Pure infra change; pack data layer switches its file source.
3. **SDK integration** — write `session_start`, `user_message`, `tool_call`, `tool_result`, `render`, `assistant_text`, `run_done` from `streamAgentResponse` and `forwardSdkMessage`. Hash everything that goes out as a tool arg / result / spec.
4. **`sourceCallId` plumbing** — schema field on every `RenderSpec`, system-prompt instruction, inference fallback in the agent route.
5. **UI** — `<CitationChip>` rendered with every render block; expandable detail panel; "Download audit bundle" link.
6. **Replay verifier** — `scripts/replay-audit.mjs`; CI smoke test that runs one prompt end-to-end and replays it.

Phases 1–4 are independent enough to land in separate PRs. Phase 5 depends on the schema change in 4. Phase 6 depends on 1–4 being in place.

## Files touched
- `src/lib/audit/types.ts`, `src/lib/audit/writer.ts`, `src/lib/audit/hash.ts` (new)
- `src/lib/packs/types.ts` (add `dataFiles`)
- `src/lib/packs/portfolio/index.ts` (declare `dataFiles`)
- `src/lib/packs/portfolio/data.ts` (read from `PACKS_SNAPSHOT_PATH` when set)
- `src/lib/agent/server.ts` (snapshot at session start, audit writes around `streamAgentResponse`, run-level `lastDataToolCallId` tracking, MCP env wiring)
- `src/lib/render-schemas.ts` (add `sourceCallId` to every spec)
- `src/lib/agent/system-prompt.ts` (instruct the agent to pass `sourceCallId`)
- `src/lib/types.ts` (extend `render` event with citation fields)
- `src/components/render/render-block.tsx` (mount `<CitationChip>`)
- `src/components/render/citation-chip.tsx` (new)
- `src/app/api/audit/[sessionId]/route.ts` (new), `src/app/api/audit/[sessionId]/bundle/route.ts` (new)
- `scripts/replay-audit.mjs` (new)
- `.gitignore` (add `.audit/`)
- `package.json` (`replay` script)

## Edge cases
- **Render with no preceding data tool** ("from prior context"): `sourceCallId = null`, `sourceConfidence = "none"`. UI shows yellow warning chip. PM is told plainly that the number is not grounded in this run.
- **Tool failure:** record `tool_result` with `error` set and `resultHash = null`. Chip shows "tool failed."
- **Cancelled run:** still write `run_done` with status `cancelled`. Audit log must be coherent even on cancel — important for compliance.
- **Streaming render updates** (same `callId` re-emitted with new args): write a new `render` event each time; the latest is canonical.
- **Concurrent runs in one session:** today's `runRegistry` allows only one at a time. If that invariant is ever relaxed, the writer's per-session append still serializes correctly.
- **Snapshot file > 50 MB:** acceptable for `portfolio.json` (currently ~30 KB). Add a hard ceiling (e.g. 100 MB per declared data file) to prevent accidental DOS.
- **PII in payloads:** none today (synthetic data). Document that the audit log mirrors tool inputs/outputs and should be treated with the same sensitivity as the data itself.
- **Disk full / write failure:** fail the run. Surface a clear error message. Better to refuse than serve uncited data.

## Risks
- **Performance.** Hashing every result on a hot path. The portfolio dataset is small (~30 KB) and tool results are typically under 50 KB, so canonical-JSON sha256 is microseconds. Re-evaluate if pack datasets grow much larger.
- **Agent forgets `sourceCallId`.** Inference fallback handles common cases (single data tool followed by single render). For multi-tool renders the inference is best-effort; expose `sourceConfidence` so the UI is honest.
- **Snapshot path divergence in dev.** If `PACKS_SNAPSHOT_PATH` is missing, we fall back to live file — convenient but breaks reproducibility. Log a warning when this happens.
- **Tamper.** File-system JSONL is trivially editable. v1 does not claim tamper-evidence. Hash-chain (each event includes prev event's hash) and an HMAC over each line are obvious next steps; explicitly out of scope here.

## Out of scope (v1)
- Tamper-evident logging (hash chains, signing, off-machine durability).
- Retention policy / log rotation / archival.
- Per-user authorization checks beyond "owner of the session cookie".
- Streaming the audit bundle out to S3 or an external SIEM.
- Diffing two sessions for compliance review.

## Success criteria
- After running "Show TEY by state" the UI shows a chip "from `portfolio__get_tax_equivalent_yield({groupBy:'state'})` · snapshot `7e9a…` · 142 ms".
- The chip expands to show args, snapshot sha256, result sha256, durationMs.
- `.audit/s_xxxxxxxxxx.jsonl` contains a coherent `session_start` → `user_message` → `tool_call` → `tool_result` → `render` → `assistant_text` → `run_done` sequence.
- `npm run replay -- s_xxxxxxxxxx` re-executes every tool call and reports `resultHash` matches for all of them.
- Downloading the audit bundle yields a zip with the JSONL plus the snapshot and any spilled payloads it references.
- A render emitted without a preceding data tool surfaces the "no live source" warning chip and writes `sourceConfidence: "none"`.
