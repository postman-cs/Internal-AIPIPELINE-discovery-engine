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
  | "AI_PIPELINE"          // AI-powered discovery pipeline
  | "WEBHOOK_INGEST"       // External webhook ingest endpoint
  | "STORY_MODE"           // Topology story mode tab
  | "COMMAND_PALETTE"      // Cmd+K command palette
  | "PROJECT_NOTES"        // Quick notes per project
  | "EXPORT_PROJECT"       // Export project data
  | "EVIDENCE_SEARCH"      // Full-text evidence search
  | "IMAGE_INGEST"         // Image upload in discovery
  | "CASCADE_AUTO_POLL"    // Auto-poll cascade status
  | "METRICS_ENDPOINT";    // Prometheus metrics

/** Default flag values — true = enabled by default */
const DEFAULTS: Record<FeatureFlag, boolean> = {
  AI_PIPELINE: true,
  WEBHOOK_INGEST: true,
  STORY_MODE: true,
  COMMAND_PALETTE: true,
  PROJECT_NOTES: true,
  EXPORT_PROJECT: true,
  EVIDENCE_SEARCH: true,
  IMAGE_INGEST: true,
  CASCADE_AUTO_POLL: true,
  METRICS_ENDPOINT: true,
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
