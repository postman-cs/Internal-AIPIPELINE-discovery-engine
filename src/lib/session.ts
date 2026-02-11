import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  email?: string;
  name?: string;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || "this-is-a-dev-secret-change-in-production-must-be-32-chars-long!!",
  cookieName: "ai-pipeline-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAuth(): Promise<SessionData & { userId: string }> {
  const session = await getSession();
  if (!session.userId) {
    throw new Error("Unauthorized");
  }
  return { userId: session.userId, email: session.email!, name: session.name! };
}
