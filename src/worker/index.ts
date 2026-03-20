/**
 * Graphile Worker Entrypoint
 *
 * Postgres-backed durable job runner for:
 * - Ingestion (fetch, normalize, chunk, embed)
 * - Snapshot creation
 * - Cascade impact analysis + proposal generation
 * - Build log tracking
 *
 * Usage: npx tsx src/worker/index.ts
 */

import { run, parseCronItems, type CronItem } from "graphile-worker";

// ---------------------------------------------------------------------------
// Job priority levels (lower = higher priority)
// ---------------------------------------------------------------------------

export const PRIORITY = {
  CRITICAL: 0,
  HIGH: 5,
  NORMAL: 10,
  LOW: 20,
} as const;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const cronItems: CronItem[] = [
  {
    task: "ingest.fetchSourceDeltas",
    match: "0 6 * * *", // Daily at 6am UTC
    options: { backfillPeriod: 0, maxAttempts: 3 },
  },
  {
    task: "secrets.checkRotation",
    match: "0 7 * * *", // Daily at 7am UTC
    options: { backfillPeriod: 0, maxAttempts: 2 },
  },
  {
    task: "openapi.autoDiscover",
    match: "0 3 * * 0", // Weekly on Sunday at 3am UTC
    options: { backfillPeriod: 0, maxAttempts: 2 },
  },
];

async function main() {
  const runner = await run({
    connectionString: DATABASE_URL,
    concurrency: 3,
    noHandleSignals: false,
    pollInterval: 1000,
    taskDirectory: `${__dirname}/tasks`,
    parsedCronItems: parseCronItems(cronItems),
  });

  console.log("[Worker] Graphile Worker started");
  console.log("[Worker] Listening for tasks...");

  await runner.promise;
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Queue depth utility
// ---------------------------------------------------------------------------

export async function getQueueDepth() {
  const { prisma } = await import("@/lib/prisma");
  const result = await prisma.$queryRaw`
    SELECT 
      COALESCE(priority, 10) as priority,
      COUNT(*) as count
    FROM graphile_worker.jobs
    WHERE locked_at IS NULL
    GROUP BY priority
    ORDER BY priority
  `;
  return result;
}
