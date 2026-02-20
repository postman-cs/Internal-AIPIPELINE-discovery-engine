/**
 * Canonical Zod schemas for all agent inputs and outputs.
 *
 * Every agent must:
 * - Accept structured input
 * - Return Zod-validated structured output
 * - Reference only real evidence IDs (EVIDENCE-N labels)
 * - No free-form text outputs allowed
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Canonical enums
// ---------------------------------------------------------------------------

export const SignalType = z.enum([
  "PrimaryCloud",
  "AuthPattern",
  "CDN",
  "BackendTech",
]);
export type SignalType = z.infer<typeof SignalType>;

export const Confidence = z.enum(["High", "Medium", "Low"]);
export type Confidence = z.infer<typeof Confidence>;

// ---------------------------------------------------------------------------
// Canonical Discovery Signal (Phase 5)
// ---------------------------------------------------------------------------

export const discoverySignalSchema = z.object({
  signalType: SignalType,
  finding: z.string(),
  evidenceIds: z.array(z.string()), // EVIDENCE-1, EVIDENCE-2, ...
  confidence: Confidence,
  reasoning: z.string(),
});

export type DiscoverySignal = z.infer<typeof discoverySignalSchema>;

// ---------------------------------------------------------------------------
// Canonical Maturity Schema (Phase 5)
// ---------------------------------------------------------------------------

export const maturityResultSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  justification: z.string(),
  evidenceIds: z.array(z.string()),
});

export type MaturityResult = z.infer<typeof maturityResultSchema>;

// ---------------------------------------------------------------------------
// Evidence citation (shared across all agents)
// ---------------------------------------------------------------------------

export const evidenceCitationSchema = z.object({
  evidenceLabel: z.string(),
  sourceType: z.string(),
  relevance: z.string(),
});

export type EvidenceCitation = z.infer<typeof evidenceCitationSchema>;

// ---------------------------------------------------------------------------
// Evidence appendix entry
// ---------------------------------------------------------------------------

export const evidenceAppendixEntrySchema = z.object({
  evidenceLabel: z.string(),
  sourceType: z.string(),
  title: z.string(),
  excerpt: z.string(),
});

export type EvidenceAppendixEntry = z.infer<typeof evidenceAppendixEntrySchema>;

// ---------------------------------------------------------------------------
// 1. ReconSynthesizer
// ---------------------------------------------------------------------------

export const reconSynthesizerOutputSchema = z.object({
  companySnapshot: z.object({
    industry: z.string(),
    engineeringSize: z.string(),
    publicApiPresence: z.enum(["Yes", "No", "Partial"]),
    summary: z.string(),
    evidenceIds: z.array(z.string()),
  }),
  technicalFindings: z.array(
    z.object({
      signal: z.string(),
      finding: z.string(),
      evidence: z.string(),
      confidence: Confidence,
      evidenceIds: z.array(z.string()),
    })
  ),
  publicFootprint: z.object({
    postmanNetwork: z.string(),
    developerPortal: z.string(),
    githubPresence: z.string(),
    evidenceIds: z.array(z.string()),
  }),
  citations: z.array(evidenceCitationSchema),
});

export type ReconSynthesizerOutput = z.infer<typeof reconSynthesizerOutputSchema>;

// ---------------------------------------------------------------------------
// 2. SignalClassifier
// ---------------------------------------------------------------------------

export const signalClassifierOutputSchema = z.object({
  signals: z.array(discoverySignalSchema),
  citations: z.array(evidenceCitationSchema),
});

export type SignalClassifierOutput = z.infer<typeof signalClassifierOutputSchema>;

// ---------------------------------------------------------------------------
// 3. MaturityScorer
// ---------------------------------------------------------------------------

export const maturityScorerOutputSchema = z.object({
  maturity: maturityResultSchema,
  strengthAreas: z.array(z.string()),
  gapAreas: z.array(z.string()),
  confidenceBySignal: z.record(SignalType, Confidence),
  citations: z.array(evidenceCitationSchema),
});

export type MaturityScorerOutput = z.infer<typeof maturityScorerOutputSchema>;

// ---------------------------------------------------------------------------
// 4. HypothesisGenerator
// ---------------------------------------------------------------------------

export const hypothesisGeneratorOutputSchema = z.object({
  hypothesis: z.string(),
  hypothesisEvidenceIds: z.array(z.string()),
  recommendedApproach: z.string(),
  conversationAngle: z.string(),
  stakeholderTargets: z.array(
    z.object({
      role: z.string(),
      why: z.string(),
      firstMeetingGoal: z.string(),
    })
  ),
  firstMeetingAgenda: z.array(
    z.object({
      timeBlock: z.string(),
      topic: z.string(),
      detail: z.string(),
    })
  ),
  citations: z.array(evidenceCitationSchema),
});

export type HypothesisGeneratorOutput = z.infer<typeof hypothesisGeneratorOutputSchema>;

// ---------------------------------------------------------------------------
// 5. BriefGenerator
// ---------------------------------------------------------------------------

export const briefGeneratorOutputSchema = z.object({
  briefMarkdown: z.string(),
  briefJson: z.object({
    projectName: z.string(),
    companySnapshot: z.record(z.unknown()),
    technicalLandscape: z.array(z.record(z.unknown())),
    maturity: z.record(z.unknown()),
    publicFootprint: z.record(z.unknown()),
    hypothesis: z.string(),
    recommendedApproach: z.record(z.unknown()),
    stakeholderTargets: z.array(z.record(z.unknown())),
    firstMeetingAgenda: z.array(z.union([z.record(z.unknown()), z.string()])),
    evidenceAppendix: z.array(z.record(z.unknown())),
  }),
  allCitations: z.array(evidenceCitationSchema),
});

export type BriefGeneratorOutput = z.infer<typeof briefGeneratorOutputSchema>;

// ---------------------------------------------------------------------------
// Orchestrator pipeline result
// ---------------------------------------------------------------------------

export const pipelineResultSchema = z.object({
  recon: reconSynthesizerOutputSchema,
  signals: signalClassifierOutputSchema,
  maturity: maturityScorerOutputSchema,
  hypothesis: hypothesisGeneratorOutputSchema,
  brief: briefGeneratorOutputSchema,
  aiRunIds: z.array(z.string()),
  allCitations: z.array(evidenceCitationSchema),
  validatedEvidenceIds: z.array(z.string()),
  /** Assumptions surfaced by discovery sub-agents for human verification */
  assumptions: z.array(z.object({
    category: z.string(),
    claim: z.string(),
    reasoning: z.string(),
    confidence: z.string(),
    evidenceIds: z.array(z.string()),
    impact: z.string(),
    blocksPhases: z.array(z.string()),
    suggestedVerification: z.string().optional(),
  })).optional(),
  /** Blockers detected from the customer/external landscape */
  detectedBlockers: z.array(z.object({
    title: z.string(),
    description: z.string(),
    domain: z.string(),
    severity: z.string(),
    rootCause: z.string(),
    rootCauseCategory: z.string(),
    blockedCapabilities: z.array(z.string()),
    blockedPhases: z.array(z.string()),
    evidenceIds: z.array(z.string()),
    suggestedMissile: z.string().optional(),
    suggestedNukeRationale: z.string().optional(),
  })).optional(),
});

export type PipelineResult = z.infer<typeof pipelineResultSchema>;

// ---------------------------------------------------------------------------
// Helper: extract all evidence IDs from any agent output
// ---------------------------------------------------------------------------

export function extractEvidenceIds(output: unknown): string[] {
  const ids = new Set<string>();

  function walk(obj: unknown) {
    if (typeof obj === "string") {
      // Match [EVIDENCE-N] patterns in text
      const matches = obj.matchAll(/EVIDENCE-\d+/g);
      for (const m of matches) ids.add(m[0]);
    } else if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
    } else if (obj && typeof obj === "object") {
      for (const [key, val] of Object.entries(obj)) {
        if (key === "evidenceIds" && Array.isArray(val)) {
          for (const id of val) {
            if (typeof id === "string") ids.add(id);
          }
        }
        walk(val);
      }
    }
  }

  walk(output);
  return Array.from(ids);
}
