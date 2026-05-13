import path from "node:path";
import type { ModelListItem, SDKAgent, SDKMessage, Run } from "@cursor/sdk";
import { appConfig } from "@/app.config";
import { enabledPacks } from "@/packs.config";
import { findToolLabel } from "../packs/registry";
import { RenderSpecByName, isRenderToolName, type RenderToolName } from "../render-schemas";
import type { AgentStreamEvent } from "../types";
import { initializeSdkNetwork } from "./network";
import { buildPrompt } from "./system-prompt";

const WORKSPACE = path.resolve(process.cwd(), ".workspace");
const MCP_SERVER_ENTRY = path.resolve(process.cwd(), "src/lib/mcp/server.ts");
const TSX_CLI_ENTRY = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
export const DEFAULT_MODEL_ID = process.env.CURSOR_MODEL ?? "composer-2";
const normalizedToolCalls = new Map<string, { name: string; args: unknown }>();
let cursorSdk: Promise<typeof import("@cursor/sdk")> | undefined;

interface Session {
  agent: SDKAgent;
  currentRun: Run | null;
}

const sessions = new Map<string, Promise<Session>>();
const activeRuns = new Map<string, Run>();

declare global {
  // eslint-disable-next-line no-var
  var __PACKS_AGENT_CACHE__: typeof sessions | undefined;
  // eslint-disable-next-line no-var
  var __PACKS_ACTIVE_RUNS__: typeof activeRuns | undefined;
}

const sessionCache = (globalThis.__PACKS_AGENT_CACHE__ ??= sessions);
const runRegistry = (globalThis.__PACKS_ACTIVE_RUNS__ ??= activeRuns);

export async function getOrCreateAgent(
  sessionId: string,
  modelId: string,
): Promise<Session> {
  const existing = sessionCache.get(sessionId);
  if (existing) return existing;

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY is not set. Add it to .env.local.");
  }

  const created = (async (): Promise<Session> => {
    const { Agent } = await loadCursorSdk();
    const agent = await Agent.create({
      apiKey,
      name: `${appConfig.appName} ${sessionId.slice(0, 6)}`,
      model: { id: modelId },
      local: { cwd: WORKSPACE },
      mcpServers: {
        packs: {
          type: "stdio",
          command: process.execPath,
          args: [TSX_CLI_ENTRY, MCP_SERVER_ENTRY],
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

export async function listModels(): Promise<ModelListItem[]> {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY is not set. Add it to .env.local.");
  }
  const { Cursor } = await loadCursorSdk();
  return Cursor.models.list({ apiKey });
}

export async function streamAgentResponse(
  sessionId: string,
  userMessage: string,
  modelId: string,
  emit: (event: AgentStreamEvent) => void,
): Promise<void> {
  let session: Session | undefined;
  let run: Run | null = null;

  try {
    session = await getOrCreateAgent(sessionId, modelId);

    run = await session.agent.send(buildPrompt(userMessage), {
      model: { id: modelId },
    });
    session.currentRun = run;
    runRegistry.set(sessionId, run);

    emit({ type: "session", sessionId, runId: run.id });

    for await (const event of run.stream()) {
      forwardSdkMessage(event, emit);
    }
    const result = await run.wait();
    emit({ type: "done", status: result.status, durationMs: result.durationMs });
  } catch (err) {
    emit({
      type: "error",
      message: friendlyAgentError(err),
    });
    emit({ type: "done", status: "error" });
  } finally {
    if (run && runRegistry.get(sessionId) === run) runRegistry.delete(sessionId);
    if (run && session?.currentRun === run) session.currentRun = null;
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
        label: findToolLabel(enabledPacks, tool.name),
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

function loadCursorSdk(): Promise<typeof import("@cursor/sdk")> {
  initializeSdkNetwork();
  return (cursorSdk ??= import("@cursor/sdk"));
}

function friendlyAgentError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("CURSOR_API_KEY")) return message;

  const code = isRecord(error) ? getString(error.code) : undefined;
  const normalized = `${message} ${code ?? ""}`.toLowerCase();

  if (isCertificateFailure(normalized)) {
    return "Cursor could not verify the TLS certificate chain. If your network inspects TLS, set NODE_EXTRA_CA_CERTS to your corporate root CA bundle and restart the dev server; do not disable TLS verification.";
  }

  if (isHttp2Failure(normalized)) {
    return "The Cursor SDK connection hit an HTTP/2 or protocol error. Set CURSOR_USE_HTTP1=true and restart the dev server for proxy, VPN, or Zscaler-style networks.";
  }

  if (isProxyFailure(normalized)) {
    return "Cursor could not connect through the configured proxy. Check HTTPS_PROXY, HTTP_PROXY, and NO_PROXY, then restart the dev server.";
  }

  return message;
}

function isCertificateFailure(message: string): boolean {
  return [
    "self_signed_cert_in_chain",
    "unable_to_verify_leaf_signature",
    "unable to verify the first certificate",
    "self signed certificate",
    "certificate has expired",
    "cert_has_expired",
  ].some((pattern) => message.includes(pattern));
}

function isHttp2Failure(message: string): boolean {
  return [
    "http/2",
    "http2",
    "err_http2",
    "rst_stream",
    "protocol error",
    "stream closed",
  ].some((pattern) => message.includes(pattern));
}

function isProxyFailure(message: string): boolean {
  return [
    "proxy",
    "connect econnrefused",
    "connect etimedout",
    "connect ehostunreach",
    "connect enetunreach",
    "econnreset",
    "enotfound",
    "eai_again",
    "socket hang up",
  ].some((pattern) => message.includes(pattern));
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
  const bareName = name.includes("__") ? name.split("__").slice(1).join("__") : name;
  switch (bareName) {
    case "list_holdings": {
      const parts: string[] = [];
      if (a.sector) parts.push(`sector=${a.sector}`);
      if (a.rating) parts.push(`rating=${a.rating}`);
      if (a.state) parts.push(`state=${a.state}`);
      if (a.revenueSector) parts.push(`muni=${a.revenueSector}`);
      if (a.amtFlag != null) parts.push(`AMT=${a.amtFlag ? "yes" : "no"}`);
      if (a.callable != null) parts.push(`callable=${a.callable ? "yes" : "no"}`);
      if (a.sortBy) parts.push(`sort=${a.sortBy}${a.sortDir ? ":" + a.sortDir : ""}`);
      if (a.limit) parts.push(`limit=${a.limit}`);
      return parts.length ? parts.join(" · ") : undefined;
    }
    case "get_tax_equivalent_yield": {
      const parts: string[] = [];
      if (a.groupBy) parts.push(`by=${a.groupBy}`);
      if (a.limit) parts.push(`limit=${a.limit}`);
      return parts.join(" · ") || undefined;
    }
    case "get_tax_lots":
    case "get_tax_loss_harvest_candidates": {
      const parts: string[] = [];
      if (a.cusip) parts.push(`CUSIP=${a.cusip}`);
      if (a.onlyLosses) parts.push("losses only");
      if (a.minLossAmount) parts.push(`min loss=${a.minLossAmount}`);
      if (a.minLossPercent) parts.push(`min loss %=${a.minLossPercent}`);
      if (a.limit) parts.push(`limit=${a.limit}`);
      return parts.join(" · ") || undefined;
    }
    case "get_realized_gains_losses":
    case "get_trade_history": {
      const parts: string[] = [];
      if (a.year) parts.push(`year=${a.year}`);
      if (a.action) parts.push(`action=${a.action}`);
      if (a.cusip) parts.push(`CUSIP=${a.cusip}`);
      if (a.limit) parts.push(`limit=${a.limit}`);
      return parts.join(" · ") || undefined;
    }
    case "get_call_maturity_schedule":
    case "get_cash_flow_projection": {
      const parts: string[] = [];
      if (a.months) parts.push(`${a.months} months`);
      if (a.bucket) parts.push(`bucket=${a.bucket}`);
      return parts.join(" · ") || undefined;
    }
    case "get_performance_vs_benchmark": {
      return a.periods ? `periods=${a.periods}` : undefined;
    }
    case "run_rate_spread_scenario": {
      const parts: string[] = [];
      if (a.scenarioId) parts.push(`scenario=${a.scenarioId}`);
      if (a.rateShockBp != null) parts.push(`rates=${a.rateShockBp}bp`);
      if (a.spreadShockBp != null) parts.push(`spreads=${a.spreadShockBp}bp`);
      if (a.groupBy) parts.push(`by=${a.groupBy}`);
      return parts.join(" · ") || undefined;
    }
    default:
      return undefined;
  }
}
