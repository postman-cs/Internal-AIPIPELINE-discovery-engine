/**
 * Discovery Intelligence Orchestrator
 *
 * Runs the full agent pipeline in deterministic sequence:
 * 1. ReconSynthesizer  -> company snapshot + technical findings
 * 2. SignalClassifier   -> structured technical signals (canonical schema)
 * 3. MaturityScorer     -> API maturity level 1-3 (canonical schema)
 * 4. HypothesisGenerator -> engagement hypothesis + stakeholders
 * 5. BriefGenerator     -> final evidence-cited Discovery Brief + Evidence Appendix
 *
 * Each agent receives the output of prior agents.
 * All evidence citations are tracked and VALIDATED end-to-end.
 * No hallucinated evidence IDs are permitted.
 */

import { runReconSynthesizer } from "./agents/reconSynthesizer";
import { runSignalClassifier } from "./agents/signalClassifier";
import { runMaturityScorer } from "./agents/maturityScorer";
import { runHypothesisGenerator } from "./agents/hypothesisGenerator";
import { runBriefGenerator } from "./agents/briefGenerator";
import type { PipelineResult, EvidenceCitation } from "./agents/types";
import { extractEvidenceIds } from "./agents/types";
import {
  getValidEvidenceLabels,
  validateEvidenceIds,
  getEvidenceByLabels,
} from "./retrieval";

export interface OrchestratorCallbacks {
  onStepStart?: (step: string, index: number) => void;
  onStepComplete?: (step: string, index: number, durationMs?: number) => void;
  onError?: (step: string, error: Error) => void;
}

const STEPS = [
  "ReconSynthesizer",
  "SignalClassifier",
  "MaturityScorer",
  "HypothesisGenerator",
  "BriefGenerator",
] as const;

/**
 * Run the full discovery intelligence pipeline for a project.
 *
 * Prerequisites:
 * - Project must have SourceDocuments with embedded DocumentChunks
 * - OpenAI API key must be configured
 *
 * Safety:
 * - After each agent, ALL referenced evidence IDs are validated against the DB.
 * - If any hallucinated evidence ID is found, the pipeline throws immediately.
 */
export async function runDiscoveryPipeline(
  projectId: string,
  projectName: string,
  callbacks?: OrchestratorCallbacks
): Promise<PipelineResult> {
  const aiRunIds: string[] = [];
  const allCitations: EvidenceCitation[] = [];
  const allReferencedIds = new Set<string>();
  const allAssumptions: NonNullable<PipelineResult["assumptions"]> = [];
  const allDetectedBlockers: NonNullable<PipelineResult["detectedBlockers"]> = [];
  let stepIndex = 0;

  // Pre-fetch the full set of valid evidence labels for this project
  const validLabels = await getValidEvidenceLabels(projectId);

  if (validLabels.size === 0) {
    throw new Error(
      "No evidence found for this project. Ingest documents first."
    );
  }

  // --- Step 1: Recon Synthesis ---
  callbacks?.onStepStart?.(STEPS[0], stepIndex);
  const recon = await runReconSynthesizer(projectId, projectName);
  aiRunIds.push(recon.aiRunId);
  allCitations.push(...recon.output.citations);
  if (recon.assumptions?.length) allAssumptions.push(...recon.assumptions);
  if (recon.detectedBlockers?.length) allDetectedBlockers.push(...recon.detectedBlockers);

  // Validate evidence IDs
  const reconIds = extractEvidenceIds(recon.output);
  validateEvidenceIds(reconIds, validLabels, STEPS[0]);
  reconIds.forEach((id) => allReferencedIds.add(id));

  callbacks?.onStepComplete?.(STEPS[0], stepIndex);
  stepIndex++;

  // --- Step 2: Signal Classification ---
  callbacks?.onStepStart?.(STEPS[1], stepIndex);
  const signals = await runSignalClassifier(
    projectId,
    projectName,
    recon.output
  );
  aiRunIds.push(signals.aiRunId);
  allCitations.push(...signals.output.citations);
  if (signals.assumptions?.length) allAssumptions.push(...signals.assumptions);
  if (signals.detectedBlockers?.length) allDetectedBlockers.push(...signals.detectedBlockers);

  const signalIds = extractEvidenceIds(signals.output);
  validateEvidenceIds(signalIds, validLabels, STEPS[1]);
  signalIds.forEach((id) => allReferencedIds.add(id));

  callbacks?.onStepComplete?.(STEPS[1], stepIndex);
  stepIndex++;

  // --- Step 3: Maturity Scoring ---
  callbacks?.onStepStart?.(STEPS[2], stepIndex);
  const maturity = await runMaturityScorer(
    projectId,
    projectName,
    recon.output,
    signals.output
  );
  aiRunIds.push(maturity.aiRunId);
  allCitations.push(...maturity.output.citations);
  if (maturity.assumptions?.length) allAssumptions.push(...maturity.assumptions);
  if (maturity.detectedBlockers?.length) allDetectedBlockers.push(...maturity.detectedBlockers);

  const maturityIds = extractEvidenceIds(maturity.output);
  validateEvidenceIds(maturityIds, validLabels, STEPS[2]);
  maturityIds.forEach((id) => allReferencedIds.add(id));

  callbacks?.onStepComplete?.(STEPS[2], stepIndex);
  stepIndex++;

  // --- Step 4: Hypothesis Generation ---
  callbacks?.onStepStart?.(STEPS[3], stepIndex);
  const hypothesis = await runHypothesisGenerator(
    projectId,
    projectName,
    recon.output,
    signals.output,
    maturity.output
  );
  aiRunIds.push(hypothesis.aiRunId);
  allCitations.push(...hypothesis.output.citations);
  if (hypothesis.assumptions?.length) allAssumptions.push(...hypothesis.assumptions);
  if (hypothesis.detectedBlockers?.length) allDetectedBlockers.push(...hypothesis.detectedBlockers);

  const hypothesisIds = extractEvidenceIds(hypothesis.output);
  validateEvidenceIds(hypothesisIds, validLabels, STEPS[3]);
  hypothesisIds.forEach((id) => allReferencedIds.add(id));

  callbacks?.onStepComplete?.(STEPS[3], stepIndex);
  stepIndex++;

  // --- Collect evidence for appendix ---
  const allIds = Array.from(allReferencedIds);
  const evidenceAppendix = await getEvidenceByLabels(projectId, allIds);

  // --- Step 5: Brief Generation ---
  callbacks?.onStepStart?.(STEPS[4], stepIndex);
  const brief = await runBriefGenerator(
    projectId,
    projectName,
    recon.output,
    signals.output,
    maturity.output,
    hypothesis.output,
    evidenceAppendix
  );
  aiRunIds.push(brief.aiRunId);
  allCitations.push(...brief.output.allCitations);
  if (brief.assumptions?.length) allAssumptions.push(...brief.assumptions);
  if (brief.detectedBlockers?.length) allDetectedBlockers.push(...brief.detectedBlockers);

  const briefIds = extractEvidenceIds(brief.output);
  validateEvidenceIds(briefIds, validLabels, STEPS[4]);
  briefIds.forEach((id) => allReferencedIds.add(id));

  callbacks?.onStepComplete?.(STEPS[4], stepIndex);

  // Deduplicate citations
  const uniqueCitations = deduplicateCitations(allCitations);

  return {
    recon: recon.output,
    signals: signals.output,
    maturity: maturity.output,
    hypothesis: hypothesis.output,
    brief: brief.output,
    aiRunIds,
    allCitations: uniqueCitations,
    validatedEvidenceIds: Array.from(allReferencedIds),
    assumptions: allAssumptions,
    detectedBlockers: allDetectedBlockers,
  };
}

function deduplicateCitations(
  citations: EvidenceCitation[]
): EvidenceCitation[] {
  const seen = new Set<string>();
  const unique: EvidenceCitation[] = [];
  for (const c of citations) {
    if (!seen.has(c.evidenceLabel)) {
      seen.add(c.evidenceLabel);
      unique.push(c);
    }
  }
  return unique;
}
