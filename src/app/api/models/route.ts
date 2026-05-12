import { AUTH_COOKIE_NAME, isValidAuthToken } from "@/lib/auth";
import { listModels } from "@/lib/agent/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  if (!isValidAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.CURSOR_API_KEY) {
    return Response.json(
      { error: "CURSOR_API_KEY is not set. Add it to .env.local." },
      { status: 503 },
    );
  }

  try {
    const models = await listModels();
    return Response.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
