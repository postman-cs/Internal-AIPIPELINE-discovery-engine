/**
 * Graphile Worker Entrypoint
 *
 * Postgres-backed durable job runner for:
 * - Ingestion (fetch, normalize, chunk, embed)
 * - Snapshot creation
 * - Cascade impact analysis + proposal generation
 * - Monitoring signal evaluation
 * - Iteration backlog creation
 *
 * Usage: npx tsx src/worker/index.ts
 */

import { run, parseCronItems, type CronItem } from "graphile-worker";

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
    task: "monitor.evaluateSignals",
    match: "0 */6 * * *", // Every 6 hours
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
