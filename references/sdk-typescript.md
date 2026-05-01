# TypeScript SDK

> Source: https://cursor.com/docs/sdk/typescript (fetched 2026-04-30)

### Public beta

The TypeScript SDK is in public beta. APIs may change before general availability.

The `@cursor/sdk` package lets you call Cursor's agent from your own code. The same agent that runs in the Cursor IDE, CLI, and web app is now scriptable from TypeScript.

## Overview

The SDK wraps local and cloud runtimes behind one interface. You write the same code regardless of where the agent runs.

| Runtime                   | What it does                                                                                                       | When to use                                                                                                                |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **Local**                 | Runs the agent inline in your Node process. Files come from disk.                                                  | Dev scripts and CI checks against a working tree.                                                                          |
| **Cloud (Cursor-hosted)** | Runs in an isolated VM with your repo cloned in. Cursor runs the VMs.                                              | When the caller doesn't have the repo, you want many agents in parallel, or runs need to survive the caller disconnecting. |
| **Cloud (self-hosted)**   | Same shape, but you run the VMs via a self-hosted pool.                                                            | Same reasons as Cursor-hosted, plus code, secrets, and build artifacts must stay in your environment.                      |

Runtime is picked by which key you pass to `Agent.create()` (`local` or `cloud`). Use the same `CURSOR_API_KEY` for either.

## Authentication

Set `CURSOR_API_KEY` (or pass `apiKey`) before creating an agent.

The SDK accepts user API keys and service account API keys for both local and cloud runs. Team Admin API keys are not yet supported.

```bash
export CURSOR_API_KEY="your-key"
```

## Core concepts

| Concept        | Description                                                                                                        |
| :------------- | :----------------------------------------------------------------------------------------------------------------- |
| **Agent**      | Durable container that holds conversation state, workspace config, and settings. Survives across multiple prompts. |
| **Run**        | One prompt submission. Owns its own stream, status, result, and cancellation.                                      |
| **SDKMessage** | Normalized stream events emitted during a run. Same shape across all runtimes.                                     |

## Installation

```bash
npm install @cursor/sdk
```

## Quick start

```typescript
import { Agent } from "@cursor/sdk";

const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2" },
  local: { cwd: process.cwd() },
});

const run = await agent.send("Summarize what this repository does");

for await (const event of run.stream()) {
  console.log(event);
}
```

## Creating agents

```typescript
function Agent.create(options: AgentOptions): Promise<SDKAgent>;
```

`Agent.create()` validates options and returns a handle immediately. Pass either `local` or `cloud` to pick a runtime.

```typescript
// Local
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2" },
  local: { cwd: "/path/to/repo" },
});

// Cloud
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2" },
  cloud: {
    repos: [{ url: "https://github.com/your-org/your-repo", startingRef: "main" }],
    autoCreatePR: true,
  },
});
```

`agent.agentId` is populated immediately. Local agents get an `agent-<uuid>` ID; cloud agents get a `bc-<uuid>` ID.

### Model parameters

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: {
    id: "composer-2",
    params: [{ id: "thinking", value: "high" }],
  },
  local: { cwd: process.cwd() },
});
```

### SDKAgent

```typescript
interface SDKAgent {
  readonly agentId: string;
  readonly model: ModelSelection | undefined;
  send(message: string | SDKUserMessage, options?: SendOptions): Promise<Run>;
  close(): void;
  reload(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
  listArtifacts(): Promise<SDKArtifact[]>;
  downloadArtifact(path: string): Promise<Buffer>;
}
```

### Agent.prompt() — one-shot

```typescript
const result = await Agent.prompt("What does the auth middleware do?", {
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2" },
  local: { cwd: process.cwd() },
});
```

## Sending messages

### Run

```typescript
type RunStatus = "running" | "finished" | "error" | "cancelled";

interface Run {
  readonly id: string;
  readonly agentId: string;
  readonly status: RunStatus;
  readonly result?: string;
  readonly model?: ModelSelection;
  readonly durationMs?: number;
  readonly git?: RunGitInfo;
  readonly createdAt?: number;
  stream(): AsyncGenerator<SDKMessage, void>;
  wait(): Promise<RunResult>;
  cancel(): Promise<void>;
  conversation(): Promise<ConversationTurn[]>;
  supports(operation: RunOperation): boolean;
  unsupportedReason(operation: RunOperation): string | undefined;
  onDidChangeStatus(listener: (status: RunStatus) => void): () => void;
}
```

### Streaming

```typescript
const run = await agent.send("Find the bug in src/auth.ts");

for await (const event of run.stream()) {
  switch (event.type) {
    case "assistant":
      for (const block of event.message.content) {
        if (block.type === "text") process.stdout.write(block.text);
      }
      break;
    case "thinking":
      process.stdout.write(event.text);
      break;
    case "tool_call":
      console.log(`[tool] ${event.name}: ${event.status}`);
      break;
    case "status":
      console.log(`[status] ${event.status}`);
      break;
  }
}
```

To send images alongside text:

```typescript
const run = await agent.send({
  text: "What's in this screenshot?",
  images: [{ data: base64Png, mimeType: "image/png" }],
});
```

### Cancelling a run

```typescript
await run.cancel();
```

### Per-send options

| Property      | Type                              | Description                                                                |
| :------------ | :-------------------------------- | :------------------------------------------------------------------------- |
| `model`       | `ModelSelection`                  | Per-send override; sticky.                                                 |
| `mcpServers`  | `Record<string, McpServerConfig>` | Inline MCP server defs; replaces creation-time servers for this run.       |
| `onStep`      | callback                          | After each completed conversation step.                                    |
| `onDelta`     | callback                          | Per raw `InteractionUpdate`.                                               |
| `local.force` | `boolean`                         | Local only; expire a stuck active run before starting this message.        |

## Stream events

```typescript
type SDKMessage =
  | SDKSystemMessage
  | SDKUserMessageEvent
  | SDKAssistantMessage
  | SDKThinkingMessage
  | SDKToolUseMessage
  | SDKStatusMessage
  | SDKTaskMessage
  | SDKRequestMessage;
```

| `type`        | Description                                                                                      | Key fields                                                    |
| :------------ | :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------ |
| `"system"`    | Init metadata. Emitted once at the start of a run.                                               | `subtype?` (`"init"`), `model?`, `tools?`                     |
| `"user"`      | Echo of the user prompt for this run.                                                            | `message.content: TextBlock[]`                                |
| `"assistant"` | Model text output.                                                                               | `message.content: (TextBlock \| ToolUseBlock)[]`              |
| `"thinking"`  | Reasoning content.                                                                               | `text`, `thinking_duration_ms?`                               |
| `"tool_call"` | Tool invocation lifecycle. Emitted at start with `args`, then again on completion with `result`. | `call_id`, `name`, `status`, `args?`, `result?`, `truncated?` |
| `"status"`    | Cloud run lifecycle transitions.                                                                 | `status`, `message?`                                          |
| `"task"`      | Task-level milestones and summaries.                                                             | `status?`, `text?`                                            |
| `"request"`   | Awaiting user input or approval.                                                                 | `request_id`                                                  |

`SDKToolUseMessage` is emitted twice: first with `status: "running"` and `args` populated, then again on completion with `status: "completed"` (or `"error"`) and `result` populated.

## Resuming agents

```typescript
await using agent = await Agent.resume("bc-abc123", {
  apiKey: process.env.CURSOR_API_KEY!,
});
```

## MCP servers

Local agents load servers from up to five sources, with first-match-wins precedence on conflicting names:

1. `mcpServers` on `agent.send()`. Replaces creation-time servers for that run.
2. `mcpServers` on `Agent.create()`.
3. Plugin servers (if `local.settingSources` includes `"plugins"`).
4. Project servers from `.cursor/mcp.json` (if `local.settingSources` includes `"project"`).
5. User servers from `~/.cursor/mcp.json` (if `local.settingSources` includes `"user"`).

### Inline (local example)

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "auto" },
  local: { cwd: process.cwd() },
  mcpServers: {
    docs: {
      type: "http",
      url: "https://example.com/mcp",
      auth: { CLIENT_ID: "client-id", scopes: ["read", "write"] },
    },
    filesystem: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
      cwd: process.cwd(),
    },
  },
});
```

## Subagents

```typescript
const agent = await Agent.create({
  model: { id: "composer-2" },
  apiKey: process.env.CURSOR_API_KEY!,
  local: { cwd: process.cwd() },
  agents: {
    "code-reviewer": {
      description: "Expert code reviewer.",
      prompt: "Review code for bugs and security.",
      model: "inherit",
    },
  },
});
```

## Resource management

```typescript
await using agent = await Agent.create({ /* ... */ });
// disposed automatically when the block exits
```

`agent.close()` starts disposal without awaiting.
`agent.reload()` picks up filesystem config changes without disposing.

## Configuration reference

### AgentOptions

| Property     | Type                                                                                                    | Description                                                            |
| :----------- | :------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------- |
| `model`      | `ModelSelection`                                                                                        | Required for local; cloud falls back to server default.                |
| `apiKey`     | `string`                                                                                                | Falls back to `CURSOR_API_KEY` env.                                    |
| `name`       | `string`                                                                                                | Human-readable agent name.                                             |
| `local`      | `{ cwd?: string \| string[]; settingSources?: SettingSource[]; sandboxOptions?: { enabled: boolean } }` | Local agent config.                                                    |
| `cloud`      | `CloudOptions`                                                                                          | Cloud agent config.                                                    |
| `mcpServers` | `Record<string, McpServerConfig>`                                                                       | Inline MCP server definitions.                                         |
| `agents`     | `Record<string, AgentDefinition>`                                                                       | Subagent definitions.                                                  |
| `agentId`    | `string`                                                                                                | Stable agent ID across invocations.                                    |

### McpServerConfig

```typescript
type McpServerConfig =
  // stdio
  | {
      type?: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;       // local only
    }
  // HTTP / SSE
  | {
      type?: "http" | "sse";
      url: string;
      headers?: Record<string, string>;
      auth?: { CLIENT_ID: string; CLIENT_SECRET?: string; scopes?: string[] };
    };
```

### ModelSelection

```typescript
interface ModelSelection {
  id: string;
  params?: ModelParameterValue[];
}

interface ModelParameterValue {
  id: string;
  value: string;
}
```

## Errors

All SDK errors extend `CursorAgentError`:

```typescript
class CursorAgentError extends Error {
  readonly isRetryable: boolean;
  readonly code?: string;
  readonly cause?: unknown;
  readonly protoErrorCode?: string;
}
```

| Error                          | When                                                                   |
| :----------------------------- | :--------------------------------------------------------------------- |
| `AuthenticationError`          | Invalid API key, not logged in.                                        |
| `RateLimitError`               | Too many requests or usage limits exceeded.                            |
| `ConfigurationError`           | Invalid model, bad request parameters.                                 |
| `IntegrationNotConnectedError` | Creating a cloud agent for a repo whose SCM provider is not connected. |
| `NetworkError`                 | Service unavailable, timeout.                                          |
| `UnknownAgentError`            | Catch-all for unclassified server or runtime errors.                   |

## Known limitations

- Inline `mcpServers` are not persisted across `Agent.resume()`. Pass them again on resume if needed.
- Artifact download is not implemented for local agents.
- `local.settingSources` does not apply to cloud agents.
- Hooks are file-based only (`.cursor/hooks.json`). No programmatic callbacks.
