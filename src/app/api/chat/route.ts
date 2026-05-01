import { cancelActiveRun, streamAgentResponse } from "@/lib/agent/server";
import { createSseStream } from "@/lib/stream/sse-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  sessionId?: string;
  message?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ChatRequest;
  const sessionId = body.sessionId?.trim();
  const message = body.message?.trim();

  if (!sessionId || !message) {
    return Response.json(
      { error: "sessionId and message are required" },
      { status: 400 },
    );
  }

  return createSseStream(async (emit, signal) => {
    const onAbort = () => {
      void cancelActiveRun(sessionId);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      await streamAgentResponse(sessionId, message, emit);
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  });
}
