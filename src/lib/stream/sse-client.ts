import type { AgentStreamEvent } from "../types";

/**
 * Read an SSE response body and emit one parsed AgentStreamEvent per
 * `event:`/`data:` chunk. Closes the stream and resolves on `done` event,
 * abort, or natural end-of-stream.
 */
export async function readAgentStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const event = parseSseChunk(chunk);
        if (event) onEvent(event);
      }
    }
    if (buffer.trim()) {
      const event = parseSseChunk(buffer);
      if (event) onEvent(event);
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

function parseSseChunk(chunk: string): AgentStreamEvent | null {
  if (!chunk.trim()) return null;
  let data = "";
  for (const line of chunk.split("\n")) {
    if (line.startsWith("data:")) {
      data += line.slice(5).trimStart();
    }
  }
  if (!data) return null;
  try {
    return JSON.parse(data) as AgentStreamEvent;
  } catch {
    return null;
  }
}
