import { cancelActiveRun } from "@/lib/agent/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { sessionId } = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
  };
  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }
  const cancelled = await cancelActiveRun(sessionId);
  return Response.json({ cancelled });
}
