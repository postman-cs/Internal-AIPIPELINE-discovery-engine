/**
 * Environment Variable Validation
 *
 * Validates required environment variables on startup.
 * Fails fast with clear error messages if critical vars are missing.
 */

import { z } from "zod";

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),

  // Required for AI features
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required for AI features").optional(),

  // Required for cron
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required for cron endpoint").optional(),

  // Optional
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  METRICS_TOKEN: z.string().optional(),
  SEED_TOKEN: z.string().optional(),
  PORT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _validated: Env | null = null;

export function validateEnv(): Env {
  if (_validated) return _validated;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    console.error(`\n❌ Environment validation failed:\n${errors}\n`);

    if (process.env.NODE_ENV === "production") {
      throw new Error("Environment validation failed. See logs for details.");
    }

    // In dev, warn but don't crash — use raw process.env as fallback
    console.warn("⚠️  Continuing in development mode with incomplete env vars.\n");
    _validated = {
      DATABASE_URL: process.env.DATABASE_URL || "",
      SESSION_SECRET: process.env.SESSION_SECRET || "",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      CRON_SECRET: process.env.CRON_SECRET,
      NODE_ENV: (process.env.NODE_ENV as "development" | "production" | "test") || "development",
      LOG_LEVEL: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "debug",
      METRICS_TOKEN: process.env.METRICS_TOKEN,
      SEED_TOKEN: process.env.SEED_TOKEN,
      PORT: process.env.PORT,
    };
    return _validated;
  }

  _validated = result.data;
  return _validated;
}

export function getEnv(): Env {
  return _validated || validateEnv();
}
