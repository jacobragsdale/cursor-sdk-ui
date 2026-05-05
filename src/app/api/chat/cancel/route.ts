import { cancelActiveRun } from "@/lib/agent/server";
import { AUTH_COOKIE_NAME, isValidAuthToken } from "@/lib/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!isValidAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
  };
  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }
  const cancelled = await cancelActiveRun(sessionId);
  return Response.json({ cancelled });
}
