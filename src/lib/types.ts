/**
 * Events sent from the server to the client over SSE.
 *
 * The discriminated union below is the contract between the chat API route
 * and the React client. Keep in sync with `lib/agent/server.ts` (server
 * emitter) and `lib/stream/sse-client.ts` (client parser).
 */

export type AgentStreamEvent =
  | { type: "session"; sessionId: string; runId: string }
  | { type: "assistant_delta"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "activity";
      kind: "data_tool" | "status" | "task";
      callId?: string;
      name?: string;
      status?: "running" | "completed" | "error";
      summary?: string;
    }
  | {
      type: "render";
      callId: string;
      name:
        | "render_kpi_card"
        | "render_data_grid"
        | "render_bar_chart"
        | "render_pie_chart"
        | "render_line_chart";
      args: unknown;
    }
  | { type: "error"; message: string }
  | { type: "done"; status: "finished" | "error" | "cancelled"; durationMs?: number };

/**
 * Block types the client renders inside a single assistant message,
 * in the order they arrive.
 */
export type AssistantBlock =
  | { kind: "text"; id: string; text: string }
  | { kind: "thinking"; id: string; text: string }
  | {
      kind: "activity";
      id: string;
      callId?: string;
      name?: string;
      status?: "running" | "completed" | "error";
      summary?: string;
    }
  | {
      kind: "render";
      id: string;
      callId: string;
      name: string;
      args: unknown;
    };

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; blocks: AssistantBlock[]; status: "streaming" | "done" | "cancelled" | "error" };
