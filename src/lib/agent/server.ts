import path from "node:path";
import type { SDKAgent, SDKMessage, Run } from "@cursor/sdk";
import { Agent } from "@cursor/sdk";
import { RenderSpecByName, isRenderToolName, type RenderToolName } from "../render-schemas";
import type { AgentStreamEvent } from "../types";
import { buildPrompt } from "./system-prompt";

const WORKSPACE = path.resolve(process.cwd(), ".workspace");
const MCP_SERVER_ENTRY = path.resolve(process.cwd(), "src/lib/mcp/server.ts");
const MODEL_ID = process.env.CURSOR_MODEL ?? "composer-2";
const normalizedToolCalls = new Map<string, { name: string; args: unknown }>();

interface Session {
  agent: SDKAgent;
  currentRun: Run | null;
}

const sessions = new Map<string, Promise<Session>>();
const activeRuns = new Map<string, Run>();

declare global {
  // eslint-disable-next-line no-var
  var __PORTFOLIO_AGENT_CACHE__: typeof sessions | undefined;
  // eslint-disable-next-line no-var
  var __PORTFOLIO_ACTIVE_RUNS__: typeof activeRuns | undefined;
}

const sessionCache = (globalThis.__PORTFOLIO_AGENT_CACHE__ ??= sessions);
const runRegistry = (globalThis.__PORTFOLIO_ACTIVE_RUNS__ ??= activeRuns);

export async function getOrCreateAgent(sessionId: string): Promise<Session> {
  const existing = sessionCache.get(sessionId);
  if (existing) return existing;

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY is not set. Add it to .env.local.");
  }

  const created = (async (): Promise<Session> => {
    const agent = await Agent.create({
      apiKey,
      name: `Portfolio analyst ${sessionId.slice(0, 6)}`,
      model: { id: MODEL_ID },
      local: { cwd: WORKSPACE },
      mcpServers: {
        portfolio: {
          type: "stdio",
          command: "npx",
          args: ["-y", "tsx", MCP_SERVER_ENTRY],
          cwd: process.cwd(),
        },
      },
    });
    return { agent, currentRun: null };
  })();

  sessionCache.set(sessionId, created);
  try {
    return await created;
  } catch (err) {
    sessionCache.delete(sessionId);
    throw err;
  }
}

export async function streamAgentResponse(
  sessionId: string,
  userMessage: string,
  emit: (event: AgentStreamEvent) => void,
): Promise<void> {
  const session = await getOrCreateAgent(sessionId);

  const run = await session.agent.send(buildPrompt(userMessage));
  session.currentRun = run;
  runRegistry.set(sessionId, run);

  emit({ type: "session", sessionId, runId: run.id });

  try {
    for await (const event of run.stream()) {
      forwardSdkMessage(event, emit);
    }
    const result = await run.wait();
    emit({ type: "done", status: result.status, durationMs: result.durationMs });
  } catch (err) {
    emit({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
    emit({ type: "done", status: "error" });
  } finally {
    if (runRegistry.get(sessionId) === run) runRegistry.delete(sessionId);
    if (session.currentRun === run) session.currentRun = null;
  }
}

export async function cancelActiveRun(sessionId: string): Promise<boolean> {
  const run = runRegistry.get(sessionId);
  if (!run) return false;
  try {
    await run.cancel();
    return true;
  } catch {
    return false;
  }
}

function forwardSdkMessage(
  event: SDKMessage,
  emit: (event: AgentStreamEvent) => void,
): void {
  switch (event.type) {
    case "assistant": {
      // Only emit text deltas here. Tool-use blocks inside the assistant
      // message are duplicated by the SDKToolUseMessage lifecycle event,
      // so we let that branch own tool emission.
      for (const block of event.message.content) {
        if (block.type === "text" && block.text) {
          emit({ type: "assistant_delta", text: block.text });
        }
      }
      return;
    }
    case "thinking": {
      if (event.text) emit({ type: "thinking", text: event.text });
      return;
    }
    case "tool_call": {
      const tool = normalizeToolCall(event);
      if (isRenderToolName(tool.name)) {
        if (tool.status === "running" && tool.args !== undefined) {
          const parsed = validateRenderArgs(tool.name, tool.args);
          if (!parsed.ok) {
            emit({
              type: "activity",
              kind: "data_tool",
              callId: tool.callId,
              name: tool.name,
              status: "error",
              summary: parsed.summary,
            });
            return;
          }
          emit({
            type: "render",
            callId: tool.callId,
            name: tool.name,
            args: parsed.args,
          });
        }
        return;
      }
      emit({
        type: "activity",
        kind: "data_tool",
        callId: tool.callId,
        name: tool.name,
        status: tool.status,
        summary: summarizeToolArgs(tool.name, tool.args),
      });
      return;
    }
    case "status": {
      if (!event.message && (event.status === "RUNNING" || event.status === "FINISHED")) {
        return;
      }
      emit({
        type: "activity",
        kind: "status",
        status: mapLifecycleStatus(event.status),
        summary: event.message ?? event.status,
      });
      return;
    }
    case "task": {
      emit({
        type: "activity",
        kind: "task",
        status: event.status === "completed" ? "completed" : "running",
        summary: event.text,
      });
      return;
    }
    default:
      return;
  }
}

interface NormalizedToolCall {
  callId: string;
  name: string;
  status: "running" | "completed" | "error";
  args: unknown;
}

function normalizeToolCall(
  event: Extract<SDKMessage, { type: "tool_call" }>,
): NormalizedToolCall {
  const cacheKey = `${event.run_id}:${event.call_id}`;
  if (event.name !== "mcp") {
    return {
      callId: event.call_id,
      name: event.name,
      status: event.status,
      args: event.args,
    };
  }

  if (isRecord(event.args)) {
    const toolName = getString(event.args.toolName) ?? getString(event.args.name);
    if (toolName) {
      const args = "args" in event.args ? event.args.args : event.args.arguments;
      normalizedToolCalls.set(cacheKey, { name: toolName, args });
      if (event.status !== "running") normalizedToolCalls.delete(cacheKey);

      return {
        callId: event.call_id,
        name: toolName,
        status: event.status,
        args,
      };
    }
  }

  const cached = normalizedToolCalls.get(cacheKey);
  if (cached) {
    if (event.status !== "running") normalizedToolCalls.delete(cacheKey);
    return {
      callId: event.call_id,
      name: cached.name,
      status: event.status,
      args: cached.args,
    };
  }
  return {
    callId: event.call_id,
    name: event.name,
    status: event.status,
    args: event.args,
  };
}

function validateRenderArgs(
  name: RenderToolName,
  args: unknown,
): { ok: true; args: unknown } | { ok: false; summary: string } {
  const parsed = RenderSpecByName[name].safeParse(args);
  if (parsed.success) return { ok: true, args: parsed.data };
  return {
    ok: false,
    summary: parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "args"}: ${issue.message}`)
      .join(" · "),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function mapLifecycleStatus(status: string): "running" | "completed" | "error" {
  if (status === "FINISHED") return "completed";
  if (status === "ERROR" || status === "EXPIRED" || status === "CANCELLED") return "error";
  return "running";
}

function summarizeToolArgs(name: string, args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const a = args as Record<string, unknown>;
  switch (name) {
    case "list_holdings": {
      const parts: string[] = [];
      if (a.sector) parts.push(`sector=${a.sector}`);
      if (a.rating) parts.push(`rating=${a.rating}`);
      if (a.sortBy) parts.push(`sort=${a.sortBy}${a.sortDir ? ":" + a.sortDir : ""}`);
      if (a.limit) parts.push(`limit=${a.limit}`);
      return parts.length ? parts.join(" · ") : undefined;
    }
    default:
      return undefined;
  }
}
