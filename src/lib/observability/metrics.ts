/**
 * Prometheus Metrics
 *
 * Exposes application metrics for scraping.
 * Access via GET /api/metrics
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

// Singleton registry
const register = new Registry();

// Collect Node.js default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register });

// ---------------------------------------------------------------------------
// Custom application metrics
// ---------------------------------------------------------------------------

export const ingestDocsTotal = new Counter({
  name: "ai_pipeline_ingest_docs_total",
  help: "Total documents ingested",
  labelNames: ["project_id", "source_type", "status"] as const,
  registers: [register],
});

export const ingestSkippedTotal = new Counter({
  name: "ai_pipeline_ingest_skipped_total",
  help: "Total documents skipped (dedup)",
  labelNames: ["project_id"] as const,
  registers: [register],
});

export const agentCallDuration = new Histogram({
  name: "ai_pipeline_agent_call_duration_seconds",
  help: "Duration of AI agent calls in seconds",
  labelNames: ["agent_type", "status"] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

export const agentTokensUsed = new Counter({
  name: "ai_pipeline_agent_tokens_total",
  help: "Total tokens used across all AI agent calls",
  labelNames: ["agent_type", "token_type"] as const,
  registers: [register],
});

export const cascadeRecomputeTotal = new Counter({
  name: "ai_pipeline_cascade_recompute_total",
  help: "Total cascade recompute jobs",
  labelNames: ["trigger"] as const,
  registers: [register],
});

export const proposalTotal = new Counter({
  name: "ai_pipeline_proposals_total",
  help: "Total proposals created/accepted/rejected",
  labelNames: ["action", "phase"] as const,
  registers: [register],
});

export const activePhaseArtifacts = new Gauge({
  name: "ai_pipeline_active_artifacts",
  help: "Current number of phase artifacts by status",
  labelNames: ["status"] as const,
  registers: [register],
});

export const snapshotsCreated = new Counter({
  name: "ai_pipeline_snapshots_created_total",
  help: "Total evidence snapshots created",
  registers: [register],
});

// ---------------------------------------------------------------------------
// Registry export
// ---------------------------------------------------------------------------

export { register };

/**
 * Get all metrics as Prometheus text format.
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}
