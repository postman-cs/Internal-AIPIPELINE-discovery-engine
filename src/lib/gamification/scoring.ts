/**
 * Project Health Scoring — Subtle gamification layer
 *
 * Computes a 0-100 health score for each project based on:
 * - Discovery completeness (how many fields are filled)
 * - Evidence density (docs + chunks ingested)
 * - Phase progress (how many phases have artifacts)
 * - Freshness (how recently was the project updated)
 * - Artifact quality (AI-generated vs manual, version count)
 */

export interface ProjectHealthScore {
  overall: number;           // 0-100
  discoveryCompleteness: number; // 0-100
  evidenceDensity: number;   // 0-100
  phaseProgress: number;     // 0-100
  freshness: number;         // 0-100
  level: "nascent" | "developing" | "solid" | "strong" | "exceptional";
  momentum: "rising" | "steady" | "cooling";
  completedPhases: number;
  totalPhases: number;
}

interface ScoringInput {
  // Discovery
  hasDiscoveryArtifact: boolean;
  discoveryVersion: number;
  isAIGenerated: boolean;
  filledFieldCount: number;   // out of ~15 key fields
  totalFieldCount: number;

  // Evidence
  sourceDocCount: number;
  chunkCount: number;

  // Phases
  phaseArtifactCount: number; // how many phases have at least 1 artifact
  totalPhases: number;        // typically 10

  // Freshness
  lastUpdatedAt: Date | null;
  lastIngestAt: Date | null;

  // Proposals
  pendingProposalCount: number;
  acceptedProposalCount: number;
}

const TOTAL_PHASES = 10;

export function computeProjectHealth(input: ScoringInput): ProjectHealthScore {
  // --- Discovery Completeness (25% weight) ---
  let discoveryCompleteness = 0;
  if (input.hasDiscoveryArtifact) {
    const fieldRatio = input.totalFieldCount > 0
      ? input.filledFieldCount / input.totalFieldCount
      : 0;
    discoveryCompleteness = Math.round(fieldRatio * 80); // fields = up to 80
    if (input.isAIGenerated) discoveryCompleteness += 10;  // AI bonus
    if (input.discoveryVersion >= 2) discoveryCompleteness += 10; // iteration bonus
  }
  discoveryCompleteness = Math.min(100, discoveryCompleteness);

  // --- Evidence Density (25% weight) ---
  let evidenceDensity = 0;
  if (input.sourceDocCount > 0) {
    // Logarithmic scale: 1 doc = 20, 5 docs = 50, 10+ docs = 70+
    evidenceDensity = Math.min(100, Math.round(20 * Math.log2(input.sourceDocCount + 1)));
    // Chunks bonus
    if (input.chunkCount >= 10) evidenceDensity = Math.min(100, evidenceDensity + 15);
    if (input.chunkCount >= 50) evidenceDensity = Math.min(100, evidenceDensity + 15);
  }

  // --- Phase Progress (30% weight) ---
  const completedPhases = input.phaseArtifactCount;
  const phaseProgress = Math.round((completedPhases / (input.totalPhases || TOTAL_PHASES)) * 100);

  // --- Freshness (20% weight) ---
  let freshness = 0;
  const now = Date.now();
  // Use the most recent date from either source
  const candidates = [input.lastUpdatedAt, input.lastIngestAt].filter(Boolean) as Date[];
  const latestDate = candidates.length > 0
    ? new Date(Math.max(...candidates.map((d) => d.getTime())))
    : null;
  if (latestDate) {
    const daysSinceUpdate = (now - latestDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate <= 1) freshness = 100;
    else if (daysSinceUpdate <= 3) freshness = 85;
    else if (daysSinceUpdate <= 7) freshness = 70;
    else if (daysSinceUpdate <= 14) freshness = 50;
    else if (daysSinceUpdate <= 30) freshness = 30;
    else freshness = 10;
  }

  // --- Overall Score ---
  const overall = Math.round(
    discoveryCompleteness * 0.25 +
    evidenceDensity * 0.25 +
    phaseProgress * 0.30 +
    freshness * 0.20
  );

  // --- Level ---
  let level: ProjectHealthScore["level"];
  if (overall >= 80) level = "exceptional";
  else if (overall >= 60) level = "strong";
  else if (overall >= 40) level = "solid";
  else if (overall >= 20) level = "developing";
  else level = "nascent";

  // --- Momentum ---
  let momentum: ProjectHealthScore["momentum"];
  if (latestDate) {
    const daysSince = (now - latestDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 2) momentum = "rising";
    else if (daysSince <= 7) momentum = "steady";
    else momentum = "cooling";
  } else {
    momentum = "cooling";
  }

  return {
    overall,
    discoveryCompleteness,
    evidenceDensity,
    phaseProgress,
    freshness,
    level,
    momentum,
    completedPhases,
    totalPhases: input.totalPhases || TOTAL_PHASES,
  };
}

/**
 * Count filled discovery fields from a discovery artifact.
 */
export function countDiscoveryFields(artifact: Record<string, unknown> | null): {
  filled: number;
  total: number;
} {
  if (!artifact) return { filled: 0, total: 15 };

  const keyFields = [
    "industry", "engineeringSize", "publicApiPresence",
    "dnsFindings", "publicFootprint", "cloudGatewaySignals",
    "developerFrictionSignals", "authForensics",
    "maturityLevel", "maturityJustification",
    "hypothesis", "recommendedApproach", "conversationAngle",
    "technicalLandscapeJson", "stakeholderTargetsJson",
  ];

  let filled = 0;
  for (const key of keyFields) {
    const val = artifact[key];
    if (val !== null && val !== undefined && val !== "" && val !== "[]") {
      filled++;
    }
  }

  return { filled, total: keyFields.length };
}

/**
 * Evidence freshness classification.
 */
export function classifyFreshness(date: Date | null): "new" | "recent" | "aging" | "stale" {
  if (!date) return "stale";
  const days = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 1) return "new";
  if (days <= 7) return "recent";
  if (days <= 30) return "aging";
  return "stale";
}
