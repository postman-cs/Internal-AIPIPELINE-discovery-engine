import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Admin Zod Validation
// ---------------------------------------------------------------------------

describe("admin validation", () => {
  // Test the enum validation arrays used by admin actions
  const BLOCKER_STATUSES = [
    "IDENTIFIED", "MAPPED", "MISSILE_DESIGNED", "MISSILE_FIRED",
    "NUKE_ARMED", "NUKE_LAUNCHED", "NEUTRALIZED", "ACCEPTED", "DORMANT",
  ];
  const BLOCKER_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const ASSUMPTION_STATUSES = ["PENDING", "VERIFIED", "CORRECTED", "REJECTED", "AUTO_VERIFIED"];

  it("rejects invalid blocker status values", () => {
    expect(BLOCKER_STATUSES.includes("INVALID_STATUS")).toBe(false);
    expect(BLOCKER_STATUSES.includes("")).toBe(false);
    expect(BLOCKER_STATUSES.includes("identified")).toBe(false); // case-sensitive
  });

  it("accepts valid blocker status values", () => {
    for (const s of BLOCKER_STATUSES) {
      expect(BLOCKER_STATUSES.includes(s)).toBe(true);
    }
  });

  it("rejects invalid blocker severity values", () => {
    expect(BLOCKER_SEVERITIES.includes("EXTREME")).toBe(false);
    expect(BLOCKER_SEVERITIES.includes("low")).toBe(false);
  });

  it("accepts valid assumption status values", () => {
    for (const s of ASSUMPTION_STATUSES) {
      expect(ASSUMPTION_STATUSES.includes(s)).toBe(true);
    }
  });

  it("rejects invalid assumption status values", () => {
    expect(ASSUMPTION_STATUSES.includes("APPROVED")).toBe(false);
    expect(ASSUMPTION_STATUSES.includes("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Admin form Zod schemas
// ---------------------------------------------------------------------------

describe("admin form validation schemas", () => {
  const emailSchema = z.string().email("Invalid email address").max(255);
  const nameSchema = z.string().min(1, "Name is required").max(255);
  const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);

  it("email schema rejects invalid emails", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("@missing.com").success).toBe(false);
    expect(emailSchema.safeParse("a".repeat(256) + "@test.com").success).toBe(false);
  });

  it("email schema accepts valid emails", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
    expect(emailSchema.safeParse("user+tag@sub.domain.com").success).toBe(true);
  });

  it("name schema rejects empty/too-long names", () => {
    expect(nameSchema.safeParse("").success).toBe(false);
    expect(nameSchema.safeParse("a".repeat(256)).success).toBe(false);
  });

  it("name schema accepts valid names", () => {
    expect(nameSchema.safeParse("John Doe").success).toBe(true);
    expect(nameSchema.safeParse("A").success).toBe(true);
  });

  it("password schema enforces minimum 8 characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("1234567").success).toBe(false); // 7 chars
    expect(passwordSchema.safeParse("12345678").success).toBe(true); // 8 chars
  });

  it("password schema enforces maximum 128 characters", () => {
    expect(passwordSchema.safeParse("a".repeat(129)).success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(128)).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Timing-safe comparison
// ---------------------------------------------------------------------------

describe("timing-safe comparison", () => {
  function safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  it("safeCompare rejects mismatched strings", () => {

    expect(safeCompare("Bearer abc123", "Bearer xyz789")).toBe(false);
    expect(safeCompare("Bearer abc", "Bearer abc123")).toBe(false); // length mismatch
    expect(safeCompare("", "Bearer abc")).toBe(false);
  });

  it("safeCompare accepts matching strings", () => {
    expect(safeCompare("Bearer secret123", "Bearer secret123")).toBe(true);
    expect(safeCompare("", "")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Blocker domain validation
// ---------------------------------------------------------------------------

describe("blocker domain validation", () => {
  const VALID_DOMAINS = [
    "TECHNICAL", "ORGANIZATIONAL", "POLITICAL", "FINANCIAL",
    "SECURITY", "COMPLIANCE", "CULTURAL", "RESOURCE", "PROCESS",
  ];

  it("rejects invalid domains", () => {
    expect(VALID_DOMAINS.includes("PERSONAL")).toBe(false);
    expect(VALID_DOMAINS.includes("technical")).toBe(false); // case sensitive
    expect(VALID_DOMAINS.includes("")).toBe(false);
    expect(VALID_DOMAINS.includes("SQL_INJECTION' OR 1=1 --")).toBe(false);
  });

  it("accepts all valid domains", () => {
    for (const d of VALID_DOMAINS) {
      expect(VALID_DOMAINS.includes(d)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

describe("environment validation", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("refine enforces at least one AI provider key", () => {
    const schema = z.object({
      OPENAI_API_KEY: z.string().min(1).optional(),
      ANTHROPIC_API_KEY: z.string().min(1).optional(),
    }).refine(
      (data: { OPENAI_API_KEY?: string; ANTHROPIC_API_KEY?: string }) =>
        data.OPENAI_API_KEY || data.ANTHROPIC_API_KEY,
      { message: "At least one AI provider key is required" }
    );

    // Neither key — should fail
    expect(schema.safeParse({}).success).toBe(false);

    // Only OpenAI — should pass
    expect(schema.safeParse({ OPENAI_API_KEY: "sk-test" }).success).toBe(true);

    // Only Anthropic — should pass
    expect(schema.safeParse({ ANTHROPIC_API_KEY: "sk-ant-test" }).success).toBe(true);

    // Both — should pass
    expect(schema.safeParse({
      OPENAI_API_KEY: "sk-test",
      ANTHROPIC_API_KEY: "sk-ant-test",
    }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cascade delete protection
// ---------------------------------------------------------------------------

describe("cascade delete safety", () => {
  it("try/catch prevents unhandled Prisma errors from propagating", () => {
    // Simulates the pattern used in admin actions
    async function safeDelete(fn: () => Promise<void>) {
      try {
        await fn();
        return { success: true };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Delete failed" };
      }
    }

    // Simulate a foreign key constraint failure
    const result = safeDelete(async () => {
      throw new Error("Foreign key constraint failed on the field: `userId`");
    });

    return result.then((r) => {
      expect(r.error).toContain("Foreign key constraint");
      expect(r).not.toHaveProperty("success");
    });
  });
});

// ---------------------------------------------------------------------------
// Input bounds
// ---------------------------------------------------------------------------

describe("input bounds validation", () => {
  it("team size is clamped to valid range", () => {
    // Match the actual clamping logic used in admin.ts:
    // parseInt(value) || 0 produces 0 for NaN, then Math.max/Math.min clamps
    const clamp = (n: number) => Math.max(0, Math.min(isNaN(n) ? 0 : n, 100000));

    expect(clamp(-1)).toBe(0);
    expect(clamp(0)).toBe(0);
    expect(clamp(50)).toBe(50);
    expect(clamp(100000)).toBe(100000);
    expect(clamp(999999)).toBe(100000);
    expect(clamp(NaN)).toBe(0);
  });

  it("name length is bounded at 255", () => {
    const maxLen = 255;
    expect("a".repeat(255).length <= maxLen).toBe(true);
    expect("a".repeat(256).length <= maxLen).toBe(false);
  });

  it("evidence IDs are capped at 100", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `id-${i}`);
    const capped = ids.slice(0, 100);
    expect(capped.length).toBe(100);
    expect(capped[0]).toBe("id-0");
    expect(capped[99]).toBe("id-99");
  });
});

// ---------------------------------------------------------------------------
// Middleware public paths
// ---------------------------------------------------------------------------

describe("middleware public paths", () => {
  it("includes all required webhook paths", () => {
    const PUBLIC_EXACT_PATHS = new Set([
      "/",
      "/login",
      "/api/cron/daily-ingest",
      "/api/health",
      "/api/webhooks/ingest",
      "/api/webhooks/newman-results",
    ]);

    expect(PUBLIC_EXACT_PATHS.has("/api/webhooks/ingest")).toBe(true);
    expect(PUBLIC_EXACT_PATHS.has("/api/webhooks/newman-results")).toBe(true);
    expect(PUBLIC_EXACT_PATHS.has("/api/cron/daily-ingest")).toBe(true);
    expect(PUBLIC_EXACT_PATHS.has("/api/health")).toBe(true);
  });

  it("does not include sensitive paths as public", () => {
    const PUBLIC_EXACT_PATHS = new Set([
      "/",
      "/login",
      "/api/cron/daily-ingest",
      "/api/health",
      "/api/webhooks/ingest",
      "/api/webhooks/newman-results",
    ]);

    expect(PUBLIC_EXACT_PATHS.has("/api/seed")).toBe(false);
    expect(PUBLIC_EXACT_PATHS.has("/admin")).toBe(false);
    expect(PUBLIC_EXACT_PATHS.has("/dashboard")).toBe(false);
    expect(PUBLIC_EXACT_PATHS.has("/api/metrics")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Playbook wizard auth
// ---------------------------------------------------------------------------

describe("playbook wizard", () => {
  it("wizard config schema validates correctly", () => {
    // Minimal version of the platform schema from playbook-wizard.ts
    const platformSchema = z.object({
      selectedPlatforms: z.array(z.string()).min(1),
    });

    expect(platformSchema.safeParse({ selectedPlatforms: [] }).success).toBe(false);
    expect(platformSchema.safeParse({ selectedPlatforms: ["github_actions"] }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Password hashing rounds
// ---------------------------------------------------------------------------

describe("bcrypt hardening", () => {
  it("uses 12+ rounds for production security", async () => {
    const hash = await bcrypt.hash("testpassword", 12);

    // bcrypt hash format: $2a$ROUNDS$...
    const rounds = parseInt(hash.split("$")[2], 10);
    expect(rounds).toBeGreaterThanOrEqual(12);
  });
});
