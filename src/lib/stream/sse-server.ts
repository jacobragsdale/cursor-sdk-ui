import type { AgentStreamEvent } from "../types";

const encoder = new TextEncoder();

export type SseEmit = (event: AgentStreamEvent) => void;

export function createSseStream(
  produce: (emit: SseEmit, signal: AbortSignal) => Promise<void>,
): Response {
  const controller = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const emit: SseEmit = (event) => {
        try {
          streamController.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          /* stream already closed */
        }
      };
      try {
        await produce(emit, controller.signal);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        try {
          streamController.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
