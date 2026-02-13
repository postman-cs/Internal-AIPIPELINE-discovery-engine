import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, SESSION_COOKIE_NAME, getSessionSecret } from "@/lib/session-config";

// ---------------------------------------------------------------------------
// Public paths — EXACT matches only (no prefix matching)
// ---------------------------------------------------------------------------

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/login",
  "/api/cron/daily-ingest",
  "/api/health",
  "/api/webhooks/ingest",
  "/api/webhooks/newman-results",
]);

// ---------------------------------------------------------------------------
// Rate limiting — simple in-memory sliding window
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 300_000; // 5 minutes
const RATE_LIMITS: Record<string, number> = {
  "/login": 10,                          // 10 attempts/min
  "/api/ingest/run": 20,                // 20 requests/min
  "/api/cron/daily-ingest": 5,          // 5 requests/min
  "default": 120,                        // 120 requests/min for other routes
};

function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now();

  // Periodic cleanup of expired entries to prevent memory leak
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

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Security headers applied to every response
// ---------------------------------------------------------------------------

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy — disable dangerous browser features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  // Content Security Policy — tighter in production
  const scriptSrc = process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'" // Production: no unsafe-eval
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"; // Dev: Next.js HMR needs eval
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
  // HSTS — only in production
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

  // ---- Rate limiting ----
  const rateKey = `${ip}:${pathname}`;
  const limit = RATE_LIMITS[pathname] ?? RATE_LIMITS["default"];
  if (isRateLimited(rateKey, limit)) {
    return addSecurityHeaders(
      NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      )
    );
  }

  // ---- Public paths (exact match only, no prefix) ----
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return addSecurityHeaders(NextResponse.next());
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
          NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        );
      }
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // ---- Seed endpoint — block entirely outside local dev ----
  if (pathname === "/api/seed" || pathname.startsWith("/api/seed/")) {
    if (process.env.NODE_ENV === "production") {
      return addSecurityHeaders(
        NextResponse.json({ error: "Not found" }, { status: 404 })
      );
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // ---- Session-authenticated routes ----
  const response = NextResponse.next();

  let sessionPassword: string;
  try {
    sessionPassword = getSessionSecret();
  } catch {
    // If SECRET is missing, refuse to serve authenticated routes
    return addSecurityHeaders(
      NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    );
  }

  const session = await getIronSession<SessionData>(request, response, {
    password: sessionPassword,
    cookieName: SESSION_COOKIE_NAME,
  });

  if (!session.userId) {
    // API routes get 401, pages get redirected
    if (pathname.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }
    return addSecurityHeaders(
      NextResponse.redirect(new URL("/login", request.url))
    );
  }

  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
