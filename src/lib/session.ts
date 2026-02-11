import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

// Re-export shared config types and functions
export {
  type SessionData,
  SESSION_COOKIE_NAME,
  getSessionSecret,
  getSessionOptions,
} from "./session-config";

import type { SessionData } from "./session-config";
import { getSessionOptions } from "./session-config";

// ---------------------------------------------------------------------------
// Session helpers — use next/headers, so NOT safe for Edge/middleware
// ---------------------------------------------------------------------------

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function requireAuth(): Promise<SessionData & { userId: string }> {
  const session = await getSession();
  if (!session.userId) {
    throw new Error("Unauthorized");
  }
  return {
    userId: session.userId,
    email: session.email ?? "",
    name: session.name ?? "",
  };
}
