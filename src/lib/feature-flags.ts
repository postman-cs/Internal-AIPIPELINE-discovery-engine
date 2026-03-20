/**
 * Feature Flags — Simple, code-driven feature flag system
 *
 * Flags can be toggled via environment variables (FF_<FLAG_NAME>=1)
 * or defaulted in code. No external service required.
 *
 * Usage:
 *   if (isEnabled("AI_PIPELINE")) { ... }
 *   if (isEnabled("WEBHOOK_INGEST")) { ... }
 */

export type FeatureFlag =
  | "AI_PIPELINE"           // AI-powered discovery pipeline
  | "WEBHOOK_INGEST"        // External webhook ingest endpoint
  | "COMMAND_PALETTE"       // Cmd+K command palette
  | "PROJECT_NOTES"         // Quick notes per project
  | "EXPORT_PROJECT"        // Export project data
  | "EVIDENCE_SEARCH"       // Full-text evidence search
  | "IMAGE_INGEST"          // Image upload in discovery
  | "CASCADE_AUTO_POLL"     // Auto-poll cascade status
  | "METRICS_ENDPOINT"      // Prometheus metrics
  | "POSTMAN_API_SYNC"      // Postman API integration (collections, envs, monitors)
  | "GIT_INTEGRATION"       // Push configs to git repos
  | "NEWMAN_EXECUTION"      // Newman dry-run execution engine
  | "PIPELINE_TEMPLATES"    // CI/CD pipeline template library
  | "PIPELINE_TRACKING"     // Pipeline adoption tracker
  | "INFRASTRUCTURE_PHASE"  // IaC / cloud provisioning phase
  | "GOVERNANCE_ENGINE"     // API governance rules engine
  | "MULTI_WORKSPACE"       // Multi-workspace / multi-team support
  | "EXPORT_PACKAGE"        // Full engagement package export
  | "NEWMAN_RESULTS"        // Newman test results ingestion webhook
  | "CONTRACT_TESTING"      // OpenAPI contract testing
  | "MONITOR_GATES"         // Postman Monitor as deployment gate
  | "ASSUMPTION_VERIFICATION"  // Human assumption verification gates
  | "BLOCKER_SYSTEM"           // Blocker Mapping → Missile → Nuke system
  | "MULTI_MODEL_ROUTING";   // Intelligent model routing (OpenAI + Anthropic)

/** Default flag values — true = enabled by default */
const DEFAULTS: Record<FeatureFlag, boolean> = {
  AI_PIPELINE: true,
  WEBHOOK_INGEST: true,
  COMMAND_PALETTE: true,
  PROJECT_NOTES: true,
  EXPORT_PROJECT: true,
  EVIDENCE_SEARCH: true,
  IMAGE_INGEST: true,
  CASCADE_AUTO_POLL: true,
  METRICS_ENDPOINT: true,
  POSTMAN_API_SYNC: true,
  GIT_INTEGRATION: true,
  NEWMAN_EXECUTION: true,
  PIPELINE_TEMPLATES: true,
  PIPELINE_TRACKING: true,
  INFRASTRUCTURE_PHASE: true,
  GOVERNANCE_ENGINE: true,
  MULTI_WORKSPACE: true,
  EXPORT_PACKAGE: true,
  NEWMAN_RESULTS: true,
  CONTRACT_TESTING: true,
  MONITOR_GATES: true,
  ASSUMPTION_VERIFICATION: true,
  BLOCKER_SYSTEM: true,
  MULTI_MODEL_ROUTING: true,
};

/**
 * Check if a feature flag is enabled.
 * Priority: env var FF_<NAME> > code default
 */
export function isEnabled(flag: FeatureFlag): boolean {
  const envKey = `FF_${flag}`;
  const envVal = process.env[envKey];

  if (envVal !== undefined) {
    return envVal === "1" || envVal === "true";
  }

  return DEFAULTS[flag] ?? false;
}

/**
 * Get all flags and their current states.
 */
export function getAllFlags(): Record<FeatureFlag, boolean> {
  const flags = {} as Record<FeatureFlag, boolean>;
  for (const flag of Object.keys(DEFAULTS) as FeatureFlag[]) {
    flags[flag] = isEnabled(flag);
  }
  return flags;
}
