import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, SESSION_COOKIE_NAME, getSessionSecret } from "@/lib/session-config";

// ---------------------------------------------------------------------------
// Public paths — EXACT matches only (no prefix matching)
// ---------------------------------------------------------------------------

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/login",
  "/about",
  "/api/cron/daily-ingest",
  "/api/health",
  "/api/webhooks/ingest",
  "/api/webhooks/newman-results",
  "/api/webhooks/evidence",
  "/api/webhooks/jira",
  "/api/webhooks/architect-ingest",
]);

// ---------------------------------------------------------------------------
// Rate limiting — hybrid Redis / in-memory sliding window
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 300_000;
const RATE_LIMITS: Record<string, number> = {
  "/login": 10,
  "/api/ingest/run": 20,
  "/api/cron/daily-ingest": 5,
  "default": 120,
};

function inMemoryRateLimit(key: string, limit: number): boolean {
  const now = Date.now();

  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

/**
 * Redis-backed rate limiting via Upstash REST API (Edge-compatible).
 * Requires REDIS_URL in the format: https://<host> and REDIS_TOKEN for auth.
 * Uses a sliding-window counter with 60s TTL.
 */
async function redisRateLimit(key: string, limit: number): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL!;
  const redisToken = process.env.REDIS_TOKEN ?? "";

  const pipeline = [
    ["INCR", key],
    ["EXPIRE", key, "60"],
  ];

  const res = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pipeline),
    signal: AbortSignal.timeout(2000),
  });

  if (!res.ok) throw new Error(`Redis responded ${res.status}`);

  const results = (await res.json()) as Array<{ result: number }>;
  const count = results[0]?.result ?? 0;
  return count > limit;
}

async function isRateLimited(key: string, limit: number): Promise<boolean> {
  if (process.env.REDIS_URL) {
    try {
      return await redisRateLimit(key, limit);
    } catch {
      // Fall through to in-memory on Redis failure
    }
  }
  return inMemoryRateLimit(key, limit);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Security headers applied to every response (Point 14: CSP nonce)
// ---------------------------------------------------------------------------

function addSecurityHeaders(response: NextResponse, nonce?: string): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  let scriptSrc: string;
  if (process.env.NODE_ENV === "production") {
    scriptSrc = "script-src 'self' 'unsafe-inline'";
  } else {
    scriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  }

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  return response;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  const nonce = crypto.randomUUID().replace(/-/g, "");

  // ---- Rate limiting ----
  const rateKey = `${ip}:${pathname}`;
  const limit = RATE_LIMITS[pathname] ?? RATE_LIMITS["default"];
  if (await isRateLimited(rateKey, limit)) {
    return addSecurityHeaders(
      NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      ),
      nonce
    );
  }

  // ---- Public paths ----
  const isPublicPrefix = pathname.startsWith("/architect/fill/");
  if (PUBLIC_EXACT_PATHS.has(pathname) || isPublicPrefix) {
    const res = NextResponse.next();
    // CSRF: set token cookie on every response for double-submit pattern
    if (!request.cookies.get("__csrf")) {
      const csrfToken = crypto.randomUUID().replace(/-/g, "");
      res.cookies.set("__csrf", csrfToken, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
    return addSecurityHeaders(res, nonce);
  }

  // ---- Static assets, etc. ----
  // (matcher already excludes _next/static, images, etc.)

  // ---- Metrics endpoint — require bearer token in production ----
  if (pathname === "/api/metrics") {
    if (process.env.NODE_ENV === "production") {
      const authHeader = request.headers.get("authorization");
      const metricsToken = process.env.METRICS_TOKEN;
      if (!metricsToken || authHeader !== `Bearer ${metricsToken}`) {
        return addSecurityHeaders(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
          nonce
        );
      }
    }
    return addSecurityHeaders(NextResponse.next(), nonce);
  }

  // ---- Seed endpoint — block entirely outside local dev ----
  if (pathname === "/api/seed" || pathname.startsWith("/api/seed/")) {
    if (process.env.NODE_ENV === "production") {
      return addSecurityHeaders(
        NextResponse.json({ error: "Not found" }, { status: 404 }),
        nonce
      );
    }
    return addSecurityHeaders(NextResponse.next(), nonce);
  }

  // ---- Session-authenticated routes ----
  const response = NextResponse.next();

  // CSRF: set double-submit cookie if not present
  if (!request.cookies.get("__csrf")) {
    const csrfToken = crypto.randomUUID().replace(/-/g, "");
    response.cookies.set("__csrf", csrfToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.headers.set("X-CSRF-Token", csrfToken);
  } else {
    response.headers.set("X-CSRF-Token", request.cookies.get("__csrf")!.value);
  }

  let sessionPassword: string;
  try {
    sessionPassword = getSessionSecret();
  } catch {
    return addSecurityHeaders(
      NextResponse.json({ error: "Server misconfigured" }, { status: 500 }),
      nonce
    );
  }

  const session = await getIronSession<SessionData>(request, response, {
    password: sessionPassword,
    cookieName: SESSION_COOKIE_NAME,
  });

  if (!session.userId) {
    if (pathname.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        nonce
      );
    }
    return addSecurityHeaders(
      NextResponse.redirect(new URL("/login", request.url)),
      nonce
    );
  }

  // ---- Admiral role enforcement (Point 12) ----
  if (pathname.startsWith("/admiral") && session.role !== "ADMIRAL" && session.role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        nonce
      );
    }
    return addSecurityHeaders(
      NextResponse.redirect(new URL("/dashboard", request.url)),
      nonce
    );
  }

  return addSecurityHeaders(response, nonce);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
