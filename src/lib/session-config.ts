/**
 * Shared session configuration — safe to import from both
 * server components AND Edge Runtime (middleware).
 *
 * Does NOT import next/headers or any server-only modules.
 */

export interface SessionData {
  userId?: string;
  email?: string;
  name?: string;
}

export const SESSION_COOKIE_NAME = "ai-pipeline-session";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET environment variable is required and must be at least 32 characters. " +
        "Generate one with: openssl rand -base64 48"
    );
  }
  return secret;
}

export function getSessionOptions() {
  return {
    password: getSessionSecret(),
    cookieName: SESSION_COOKIE_NAME,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 8, // 8 hours
    },
  };
}
