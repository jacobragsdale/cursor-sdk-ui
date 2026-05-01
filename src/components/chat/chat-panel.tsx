"use client";

import { nanoid } from "@/lib/id";
import { readAgentStream } from "@/lib/stream/sse-client";
import type { AgentStreamEvent, AssistantBlock, ChatMessage } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageList } from "./message-list";
import { PromptInput } from "./prompt-input";

const SUGGESTIONS = [
  "Show me the sector breakdown",
  "List the top 10 holdings by market value as a table",
  "What's our overall yield and duration?",
  "Compare AAA vs BBB exposure",
  "How is the maturity profile distributed?",
];

interface ChatPanelProps {
  apiKeyConfigured: boolean;
}

const ANALYSIS_CALL_ID = "__analysis__";

export function ChatPanel({ apiKeyConfigured }: ChatPanelProps) {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem("portfolio.sessionId") : null;
    if (stored) {
      setSessionId(stored);
    } else {
      const id = `s_${nanoid()}`;
      window.localStorage.setItem("portfolio.sessionId", id);
      setSessionId(id);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || !text.trim() || streaming || !apiKeyConfigured) return;
      const userMsg: ChatMessage = { id: nanoid(), role: "user", text: text.trim() };
      const assistantId = nanoid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        blocks: [],
        status: "streaming",
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text.trim() }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Request failed with status ${res.status}`);
        }
        if (!res.body) throw new Error("No response body");

        await readAgentStream(
          res.body,
          (event) => applyEvent(setMessages, assistantId, event),
          controller.signal,
        );
      } catch (err) {
        if (controller.signal.aborted) {
          updateAssistant(setMessages, assistantId, (m) => ({ ...m, status: "cancelled" }));
        } else {
          appendBlock(setMessages, assistantId, {
            kind: "activity",
            id: nanoid(),
            status: "error",
            summary: friendlyErrorMessage(err instanceof Error ? err.message : String(err)),
          });
          updateAssistant(setMessages, assistantId, (m) => ({ ...m, status: "error" }));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [sessionId, streaming, apiKeyConfigured],
  );

  const stop = useCallback(async () => {
    if (!streaming) return;
    abortRef.current?.abort();
    if (sessionId) {
      void fetch("/api/chat/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
  }, [streaming, sessionId]);

  const isEmpty = messages.length === 0;

  const suggestionList = useMemo(
    () =>
      SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => sendMessage(s)}
          disabled={!apiKeyConfigured || streaming}
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {s}
        </button>
      )),
    [sendMessage, apiKeyConfigured, streaming],
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        {isEmpty ? (
          <EmptyState apiKeyConfigured={apiKeyConfigured}>
            <div className="flex flex-wrap justify-center gap-2 px-6">{suggestionList}</div>
          </EmptyState>
        ) : (
          <MessageList messages={messages} streaming={streaming} />
        )}
      </div>
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur">
        <div className="px-4 py-4 sm:px-6">
          <PromptInput
            onSubmit={sendMessage}
            onStop={stop}
            streaming={streaming}
            disabled={!apiKeyConfigured}
            notice={
              apiKeyConfigured
                ? undefined
                : "Cursor API key is not configured. Add CURSOR_API_KEY to .env.local and restart the dev server."
            }
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  apiKeyConfigured,
  children,
}: {
  apiKeyConfigured: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-4 py-10 text-center">
      <div className="max-w-2xl space-y-3">
        <div className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ask the portfolio a question.
        </div>
        <div className="text-sm leading-6 text-[var(--color-fg-muted)]">
          Start with allocation, credit quality, rate risk, yield, duration, or a holdings list.
        </div>
      </div>
      {!apiKeyConfigured && (
        <div className="max-w-xl rounded-lg border border-[var(--color-negative)]/35 bg-[var(--color-negative)]/10 px-4 py-3 text-sm text-[var(--color-negative)]">
          CURSOR_API_KEY is missing. Configure the key to run the live demo.
        </div>
      )}
      {children}
    </div>
  );
}

function applyEvent(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  assistantId: string,
  event: AgentStreamEvent,
) {
  switch (event.type) {
    case "session":
      return;
    case "assistant_delta":
      appendOrExtendText(setMessages, assistantId, event.text);
      return;
    case "thinking":
      appendAnalysisActivity(setMessages, assistantId);
      return;
    case "activity":
      appendActivity(setMessages, assistantId, {
        kind: "activity",
        id: nanoid(),
        callId: event.callId,
        name: event.name,
        status: event.status,
        summary: event.summary,
      });
      return;
    case "render":
      appendOrUpdateRender(setMessages, assistantId, {
        kind: "render",
        id: nanoid(),
        callId: event.callId,
        name: event.name,
        args: event.args,
      });
      return;
    case "error":
      appendBlock(setMessages, assistantId, {
        kind: "activity",
        id: nanoid(),
        status: "error",
        summary: friendlyErrorMessage(event.message),
      });
      return;
    case "done":
      completeAnalysisActivity(setMessages, assistantId);
      updateAssistant(setMessages, assistantId, (m) => ({
        ...m,
        status:
          event.status === "finished"
            ? "done"
            : event.status === "cancelled"
              ? "cancelled"
              : "error",
      }));
      return;
  }
}

function appendAnalysisActivity(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  assistantId: string,
) {
  appendActivity(setMessages, assistantId, {
    kind: "activity",
    id: nanoid(),
    callId: ANALYSIS_CALL_ID,
    name: "analysis",
    status: "running",
    summary: "Analyzing request",
  });
}

function completeAnalysisActivity(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  assistantId: string,
) {
  updateAssistant(setMessages, assistantId, (m) => ({
    ...m,
    blocks: m.blocks.map((block) =>
      block.kind === "activity" && block.callId === ANALYSIS_CALL_ID
        ? { ...block, status: "completed", summary: "Analysis complete" }
        : block,
    ),
  }));
}

function updateAssistant(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  assistantId: string,
  update: (m: Extract<ChatMessage, { role: "assistant" }>) => Extract<ChatMessage, { role: "assistant" }>,
) {
  setMessages((prev) =>
    prev.map((m) => (m.id === assistantId && m.role === "assistant" ? update(m) : m)),
  );
}

function appendBlock(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  assistantId: string,
  block: AssistantBlock,
) {
  updateAssistant(setMessages, assistantId, (m) => ({ ...m, blocks: [...m.blocks, block] }));
}

function appendOrExtendText(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  assistantId: string,
  text: string,
) {
  if (!text.trim()) return;
  updateAssistant(setMessages, assistantId, (m) => {
    const last = m.blocks[m.blocks.length - 1];
    if (last && last.kind === "text") {
      const cleaned = cleanAssistantText(last.text + text);
      if (!cleaned) return { ...m, blocks: m.blocks.slice(0, -1) };
      const merged = { ...last, text: cleaned };
      return { ...m, blocks: [...m.blocks.slice(0, -1), merged] };
    }
    const cleaned = cleanAssistantText(text);
    if (!cleaned) return m;
    return { ...m, blocks: [...m.blocks, { kind: "text", id: nanoid(), text: cleaned }] };
  });
}

function appendActivity(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  assistantId: string,
  block: Extract<AssistantBlock, { kind: "activity" }>,
) {
  updateAssistant(setMessages, assistantId, (m) => {
    if (block.callId) {
      const existingIdx = m.blocks.findIndex(
        (b) => b.kind === "activity" && b.callId === block.callId,
      );
      if (existingIdx >= 0) {
        const merged = { ...m.blocks[existingIdx], ...block, id: m.blocks[existingIdx].id };
        const next = m.blocks.slice();
        next[existingIdx] = merged as AssistantBlock;
        return { ...m, blocks: next };
      }
    }
    return { ...m, blocks: [...m.blocks, block] };
  });
}

function friendlyErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (message.includes("CURSOR_API_KEY")) {
    return "Cursor API key is not configured. Add CURSOR_API_KEY to .env.local and restart the dev server.";
  }
  if (normalized.includes("unauthorized") || normalized.includes("forbidden")) {
    return "Cursor rejected the request. Check that CURSOR_API_KEY is valid and has access to the selected model.";
  }
  if (
    normalized.includes("self_signed_cert_in_chain") ||
    normalized.includes("unable_to_verify_leaf_signature") ||
    normalized.includes("unable to verify the first certificate") ||
    normalized.includes("self signed certificate")
  ) {
    return "Cursor could not verify the TLS certificate chain. If your network inspects TLS, set NODE_EXTRA_CA_CERTS to your corporate root CA bundle and restart the dev server; do not disable TLS verification.";
  }
  if (
    normalized.includes("http/2") ||
    normalized.includes("http2") ||
    normalized.includes("err_http2") ||
    normalized.includes("rst_stream") ||
    normalized.includes("protocol error")
  ) {
    return "The Cursor SDK connection hit an HTTP/2 or protocol error. Set CURSOR_USE_HTTP1=true and restart the dev server for proxy, VPN, or Zscaler-style networks.";
  }
  if (
    normalized.includes("proxy") ||
    normalized.includes("connect econnrefused") ||
    normalized.includes("connect etimedout") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound")
  ) {
    return "Cursor could not connect through the configured proxy. Check HTTPS_PROXY, HTTP_PROXY, and NO_PROXY, then restart the dev server.";
  }
  return message;
}

function cleanAssistantText(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !isProcessNarration(sentence));
  return sentences.join(" ").trim();
}

function isProcessNarration(sentence: string): boolean {
  const normalized = sentence.toLowerCase();
  const processVerb =
    /\b(fetching|gathering|loading|rendering|displaying|visualizing|calling|using|fixing)\b/.test(
      normalized,
    );
  const implementationObject =
    /\b(data|tool|tools|chart|charts|grid|kpi|schema|escape|escaped|render|rendered|visual|component)\b/.test(
      normalized,
    );
  return processVerb && implementationObject;
}

function appendOrUpdateRender(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  assistantId: string,
  block: Extract<AssistantBlock, { kind: "render" }>,
) {
  updateAssistant(setMessages, assistantId, (m) => {
    const existingIdx = m.blocks.findIndex(
      (b) => b.kind === "render" && b.callId === block.callId,
    );
    if (existingIdx >= 0) {
      const merged = { ...m.blocks[existingIdx], ...block, id: m.blocks[existingIdx].id };
      const next = m.blocks.slice();
      next[existingIdx] = merged as AssistantBlock;
      return { ...m, blocks: next };
    }
    return { ...m, blocks: [...m.blocks, block] };
  });
}
