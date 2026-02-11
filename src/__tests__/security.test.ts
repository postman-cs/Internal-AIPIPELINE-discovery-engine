import { describe, it, expect, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Session secret validation
// ---------------------------------------------------------------------------

describe("session-config", () => {
  const originalEnv = process.env.SESSION_SECRET;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SESSION_SECRET = originalEnv;
    } else {
      delete process.env.SESSION_SECRET;
    }
    // Clear module cache to re-evaluate
    vi.resetModules();
  });

  it("throws if SESSION_SECRET is missing", async () => {
    delete process.env.SESSION_SECRET;
    const { getSessionSecret } = await import("@/lib/session-config");
    expect(() => getSessionSecret()).toThrow("SESSION_SECRET");
  });

  it("throws if SESSION_SECRET is too short", async () => {
    process.env.SESSION_SECRET = "too-short";
    const { getSessionSecret } = await import("@/lib/session-config");
    expect(() => getSessionSecret()).toThrow("at least 32 characters");
  });

  it("returns the secret when valid", async () => {
    process.env.SESSION_SECRET = "a".repeat(48);
    const { getSessionSecret } = await import("@/lib/session-config");
    expect(getSessionSecret()).toBe("a".repeat(48));
  });

  it("session options include maxAge for cookie expiration", async () => {
    process.env.SESSION_SECRET = "a".repeat(48);
    const { getSessionOptions } = await import("@/lib/session-config");
    const opts = getSessionOptions();
    expect(opts.cookieOptions.maxAge).toBeGreaterThan(0);
    expect(opts.cookieOptions.httpOnly).toBe(true);
    expect(opts.cookieOptions.sameSite).toBe("lax");
  });
});

// ---------------------------------------------------------------------------
// Input validation limits
// ---------------------------------------------------------------------------

describe("input validation", () => {
  it("login schema rejects email longer than 320 chars", async () => {
    const { loginSchema } = await import("@/lib/schemas");
    const result = loginSchema.safeParse({
      email: "a".repeat(310) + "@example.com",
      password: "test123",
    });
    expect(result.success).toBe(false);
  });

  it("login schema rejects password longer than 256 chars", async () => {
    const { loginSchema } = await import("@/lib/schemas");
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "a".repeat(257),
    });
    expect(result.success).toBe(false);
  });

  it("login schema accepts valid credentials", async () => {
    const { loginSchema } = await import("@/lib/schemas");
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "validpassword",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error sanitization
// ---------------------------------------------------------------------------

describe("error sanitization", () => {
  it("rbacErrorResponse does not leak internal error details", async () => {
    const { rbacErrorResponse } = await import("@/lib/rbac");

    // Simulate a database connection error
    const dbError = new Error(
      "FATAL: password authentication failed for user \"admin\" at Connection.parseE (/app/node_modules/pg/lib/connection.js:614:13)"
    );
    const res = rbacErrorResponse(dbError);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    // Must NOT contain any of the sensitive details
    expect(body.error).not.toContain("password");
    expect(body.error).not.toContain("admin");
    expect(body.error).not.toContain("pg");
  });

  it("rbacErrorResponse still returns specific messages for known errors", async () => {
    const { rbacErrorResponse, ForbiddenError, NotFoundError } = await import("@/lib/rbac");

    const forbidden = rbacErrorResponse(new ForbiddenError());
    expect(forbidden.status).toBe(403);

    const notFound = rbacErrorResponse(new NotFoundError());
    expect(notFound.status).toBe(404);

    const unauth = rbacErrorResponse(new Error("Unauthorized"));
    expect(unauth.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Rate limit logic (unit test the algorithm)
// ---------------------------------------------------------------------------

describe("rate limiting", () => {
  it("rate limit map tracks requests correctly", () => {
    // Simple test of the sliding window concept
    const map = new Map<string, { count: number; resetAt: number }>();
    const WINDOW = 60_000;
    const LIMIT = 10;

    function isLimited(key: string): boolean {
      const now = Date.now();
      const entry = map.get(key);
      if (!entry || now > entry.resetAt) {
        map.set(key, { count: 1, resetAt: now + WINDOW });
        return false;
      }
      entry.count++;
      return entry.count > LIMIT;
    }

    const key = "test-ip:/login";

    // First 10 requests should pass
    for (let i = 0; i < LIMIT; i++) {
      expect(isLimited(key)).toBe(false);
    }

    // 11th request should be rate limited
    expect(isLimited(key)).toBe(true);
  });
});
