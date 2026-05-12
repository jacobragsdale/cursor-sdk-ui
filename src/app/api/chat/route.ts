import {
  DEFAULT_MODEL_ID,
  cancelActiveRun,
  streamAgentResponse,
} from "@/lib/agent/server";
import { AUTH_COOKIE_NAME, isValidAuthToken } from "@/lib/auth";
import { createSseStream } from "@/lib/stream/sse-server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  sessionId?: string;
  message?: string;
  modelId?: string;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!isValidAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as ChatRequest;
  const sessionId = body.sessionId?.trim();
  const message = body.message?.trim();
  const modelId = body.modelId?.trim() || DEFAULT_MODEL_ID;

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
      await streamAgentResponse(sessionId, message, modelId, emit);
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  });
}
