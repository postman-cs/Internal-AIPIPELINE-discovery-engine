/**
 * Human Assumption Verification Engine
 *
 * Core logic for extracting, storing, verifying, and feeding back assumptions
 * throughout the AI pipeline. This is the mechanism that keeps human and AI
 * collaborating on the "golden happy path" for enterprise customers.
 *
 * Flow:
 * 1. Each agent phase generates output + surfaces key assumptions
 * 2. Assumptions are stored as PENDING checkpoints
 * 3. The cascade engine pauses at verification gates
 * 4. Humans verify/correct/reject assumptions
 * 5. Verified assumptions become constraints for downstream phases
 * 6. If corrections change upstream assumptions, affected phases re-run
 *
 * This prevents the AI from going 6+ phases deep on wrong assumptions.
 */

import { prisma } from "@/lib/prisma";
import { Phase, AssumptionStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { AssumptionItem, VerifiedAssumptionConstraint } from "@/lib/ai/agents/topologyTypes";
import { logger } from "@/lib/logger";

const log = logger.child("assumptions.engine");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssumptionCheckpoint {
  phase: Phase;
  assumptions: Array<{
    id: string;
    category: string;
    claim: string;
    reasoning: string | null;
    confidence: string;
    impact: string | null;
    status: AssumptionStatus;
    humanResponse: string | null;
    evidenceIds: string[];
    blocksPhases: string[];
    suggestedVerification?: string;
  }>;
  allVerified: boolean;
  blockerCount: number;
  pendingCount: number;
}

export interface VerificationSummary {
  totalAssumptions: number;
  verified: number;
  corrected: number;
  rejected: number;
  pending: number;
  autoVerified: number;
  criticalPending: Array<{
    id: string;
    category: string;
    claim: string;
    impact: string | null;
    blocksPhases: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Assumption Extraction: Store assumptions from agent output
// ---------------------------------------------------------------------------

/**
 * Extract and persist assumptions surfaced by an AI agent.
 * Called after each agent run, before the proposal is created.
 */
export async function persistPhaseAssumptions(
  projectId: string,
  phase: Phase,
  assumptions: AssumptionItem[],
  recomputeJobId?: string
): Promise<string[]> {
  log.info("Persisting phase assumptions", {
    projectId,
    phase,
    count: assumptions.length,
  });

  // Clean up stale PENDING and AUTO_VERIFIED assumptions from prior runs
  // for this phase. Human-reviewed ones (VERIFIED, CORRECTED, REJECTED) are preserved.
  await prisma.assumption.deleteMany({
    where: {
      projectId,
      phase,
      status: { in: ["PENDING", "AUTO_VERIFIED"] },
    },
  });

  // Check for existing verified assumptions in the same category.
  // If a human already verified an assumption in a prior run,
  // auto-verify matching assumptions (prevents re-asking known facts).
  const existingVerified = await prisma.assumption.findMany({
    where: {
      projectId,
      status: { in: ["VERIFIED", "CORRECTED"] },
    },
    select: { category: true, claim: true, humanResponse: true, status: true },
  });

  const verifiedClaims = new Map<string, { claim: string; response: string | null; status: AssumptionStatus }>();
  for (const v of existingVerified) {
    verifiedClaims.set(v.category, {
      claim: v.claim,
      response: v.humanResponse,
      status: v.status,
    });
  }

  const ids: string[] = [];

  for (const assumption of assumptions) {
    // Check if this category was already verified in a prior run
    const priorVerification = verifiedClaims.get(assumption.category);
    let status: AssumptionStatus = "PENDING";

    if (priorVerification) {
      // If the claim is substantially the same, auto-verify
      const claimSimilar = normalizeForComparison(assumption.claim) ===
        normalizeForComparison(priorVerification.claim);

      if (claimSimilar) {
        status = "AUTO_VERIFIED";
        log.info("Auto-verified assumption from prior verification", {
          category: assumption.category,
          phase,
        });
      }
    }

    const record = await prisma.assumption.create({
      data: {
        projectId,
        phase,
        category: assumption.category,
        claim: assumption.claim,
        reasoning: assumption.reasoning,
        confidence: assumption.confidence,
        evidenceIds: assumption.evidenceIds as Prisma.InputJsonValue,
        impact: assumption.impact,
        status,
        humanResponse: status === "AUTO_VERIFIED" ? priorVerification?.response ?? null : null,
        blocksPhases: assumption.blocksPhases as Prisma.InputJsonValue,
        recomputeJobId: recomputeJobId ?? null,
      },
    });

    ids.push(record.id);
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Verification: Human reviews assumptions
// ---------------------------------------------------------------------------

/**
 * Human verifies an assumption as correct.
 */
export async function verifyAssumption(
  assumptionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const assumption = await prisma.assumption.findUnique({
    where: { id: assumptionId },
  });
  if (!assumption) return { success: false, error: "Assumption not found" };
  if (assumption.status !== "PENDING") {
    return { success: false, error: `Assumption already ${assumption.status}` };
  }

  await prisma.assumption.update({
    where: { id: assumptionId },
    data: {
      status: "VERIFIED",
      verifiedBy: userId,
      verifiedAt: new Date(),
    },
  });

  log.info("Assumption verified", { id: assumptionId, category: assumption.category });
  return { success: true };
}

/**
 * Human corrects an assumption — provides the right answer.
 * This is the critical path: corrections may invalidate downstream phases.
 */
export async function correctAssumption(
  assumptionId: string,
  userId: string,
  correction: string
): Promise<{ success: boolean; invalidatedPhases?: Phase[]; error?: string }> {
  const assumption = await prisma.assumption.findUnique({
    where: { id: assumptionId },
  });
  if (!assumption) return { success: false, error: "Assumption not found" };
  if (assumption.status !== "PENDING") {
    return { success: false, error: `Assumption already ${assumption.status}` };
  }

  await prisma.assumption.update({
    where: { id: assumptionId },
    data: {
      status: "CORRECTED",
      humanResponse: correction,
      verifiedBy: userId,
      verifiedAt: new Date(),
    },
  });

  // Determine which downstream phases need to be re-evaluated
  const blocksPhases = (assumption.blocksPhases as string[]) ?? [];
  const invalidatedPhases = blocksPhases as Phase[];

  log.info("Assumption corrected", {
    id: assumptionId,
    category: assumption.category,
    invalidatedPhases,
  });

  return { success: true, invalidatedPhases };
}

/**
 * Human rejects an assumption entirely — the AI got this wrong.
 */
export async function rejectAssumption(
  assumptionId: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean; invalidatedPhases?: Phase[]; error?: string }> {
  const assumption = await prisma.assumption.findUnique({
    where: { id: assumptionId },
  });
  if (!assumption) return { success: false, error: "Assumption not found" };
  if (assumption.status !== "PENDING") {
    return { success: false, error: `Assumption already ${assumption.status}` };
  }

  await prisma.assumption.update({
    where: { id: assumptionId },
    data: {
      status: "REJECTED",
      humanResponse: reason ?? null,
      verifiedBy: userId,
      verifiedAt: new Date(),
    },
  });

  const blocksPhases = (assumption.blocksPhases as string[]) ?? [];

  log.info("Assumption rejected", {
    id: assumptionId,
    category: assumption.category,
    blocksPhases,
  });

  return { success: true, invalidatedPhases: blocksPhases as Phase[] };
}

/**
 * Bulk-verify all PENDING assumptions for a phase (human fast-tracks).
 */
export async function bulkVerifyPhaseAssumptions(
  projectId: string,
  phase: Phase,
  userId: string
): Promise<{ verified: number }> {
  const result = await prisma.assumption.updateMany({
    where: { projectId, phase, status: "PENDING" },
    data: {
      status: "VERIFIED",
      verifiedBy: userId,
      verifiedAt: new Date(),
    },
  });

  log.info("Bulk-verified assumptions", { projectId, phase, count: result.count });
  return { verified: result.count };
}

// ---------------------------------------------------------------------------
// Checkpoint Gates: Check if a phase can proceed
// ---------------------------------------------------------------------------

/**
 * Check if all critical assumptions for a phase have been verified.
 * Returns false if there are PENDING assumptions with High confidence
 * that block downstream phases.
 *
 * Gate policy:
 * - High-confidence assumptions: MUST be verified before proceeding
 * - Medium-confidence assumptions: SHOULD be verified (warning, not blocking)
 * - Low-confidence assumptions: auto-proceed, review later
 */
export async function isPhaseGateClear(
  projectId: string,
  phase: Phase
): Promise<{
  clear: boolean;
  pendingCritical: number;
  pendingNonCritical: number;
  totalPending: number;
}> {
  const assumptions = await prisma.assumption.findMany({
    where: { projectId, phase, status: "PENDING" },
    select: { confidence: true },
  });

  const pendingCritical = assumptions.filter((a) => a.confidence === "High").length;
  const pendingNonCritical = assumptions.filter((a) => a.confidence !== "High").length;

  return {
    clear: pendingCritical === 0,
    pendingCritical,
    pendingNonCritical,
    totalPending: assumptions.length,
  };
}

/**
 * Get the full assumption checkpoint for a phase.
 */
export async function getPhaseCheckpoint(
  projectId: string,
  phase: Phase
): Promise<AssumptionCheckpoint> {
  const assumptions = await prisma.assumption.findMany({
    where: { projectId, phase },
    orderBy: [{ confidence: "asc" }, { createdAt: "asc" }],
  });

  const mapped = assumptions.map((a) => ({
    id: a.id,
    category: a.category,
    claim: a.claim,
    reasoning: a.reasoning,
    confidence: a.confidence,
    impact: a.impact,
    status: a.status,
    humanResponse: a.humanResponse,
    evidenceIds: (a.evidenceIds as string[]) ?? [],
    blocksPhases: (a.blocksPhases as string[]) ?? [],
  }));

  const pending = mapped.filter((a) => a.status === "PENDING");
  const blockers = pending.filter((a) => a.confidence === "High");

  return {
    phase,
    assumptions: mapped,
    allVerified: pending.length === 0,
    blockerCount: blockers.length,
    pendingCount: pending.length,
  };
}

// ---------------------------------------------------------------------------
// Feedback: Build constraint prompt from verified assumptions
// ---------------------------------------------------------------------------

/**
 * Gather all verified/corrected assumptions for a project and format them
 * as constraints that downstream agents must respect.
 *
 * This is the feedback loop: human corrections flow back into AI prompts.
 */
export async function getVerifiedConstraints(
  projectId: string
): Promise<VerifiedAssumptionConstraint[]> {
  const verified = await prisma.assumption.findMany({
    where: {
      projectId,
      status: { in: ["VERIFIED", "CORRECTED"] },
    },
    orderBy: { phase: "asc" },
  });

  return verified.map((a) => ({
    category: a.category as VerifiedAssumptionConstraint["category"],
    originalClaim: a.claim,
    verifiedClaim: a.humanResponse ?? a.claim,
    status: a.status === "CORRECTED" ? "corrected" as const : "verified" as const,
    verifiedBy: a.verifiedBy ?? "system",
    phase: a.phase,
  }));
}

/**
 * Format verified constraints as a prompt block for injection into agent prompts.
 * This ensures downstream agents respect human-verified facts.
 */
export async function buildConstraintPromptBlock(
  projectId: string
): Promise<string> {
  const constraints = await getVerifiedConstraints(projectId);

  if (constraints.length === 0) {
    return "";
  }

  const lines = constraints.map((c) => {
    const prefix = c.status === "corrected" ? "[CORRECTED]" : "[VERIFIED]";
    const claim = c.status === "corrected" ? c.verifiedClaim : c.originalClaim;
    return `  ${prefix} ${c.category}: ${claim}`;
  });

  return `
HUMAN-VERIFIED ASSUMPTIONS (you MUST respect these — do NOT contradict):
${lines.join("\n")}

If any of your analysis contradicts the above verified facts, defer to the human's
verification. These have been explicitly confirmed or corrected by the engagement owner.
`;
}

// ---------------------------------------------------------------------------
// Summary: Overall verification status for a project
// ---------------------------------------------------------------------------

/**
 * Get a summary of all assumptions and their verification status.
 */
export async function getVerificationSummary(
  projectId: string
): Promise<VerificationSummary> {
  const all = await prisma.assumption.findMany({
    where: { projectId },
    select: {
      id: true,
      category: true,
      claim: true,
      impact: true,
      status: true,
      confidence: true,
      blocksPhases: true,
    },
  });

  const verified = all.filter((a) => a.status === "VERIFIED").length;
  const corrected = all.filter((a) => a.status === "CORRECTED").length;
  const rejected = all.filter((a) => a.status === "REJECTED").length;
  const pending = all.filter((a) => a.status === "PENDING").length;
  const autoVerified = all.filter((a) => a.status === "AUTO_VERIFIED").length;

  const criticalPending = all
    .filter((a) => a.status === "PENDING" && a.confidence === "High")
    .map((a) => ({
      id: a.id,
      category: a.category,
      claim: a.claim,
      impact: a.impact,
      blocksPhases: (a.blocksPhases as string[]) ?? [],
    }));

  return {
    totalAssumptions: all.length,
    verified,
    corrected,
    rejected,
    pending,
    autoVerified,
    criticalPending,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Determine which assumption categories are most critical for a given phase.
 * Used to guide the AI on what to surface.
 */
export function getCriticalCategoriesForPhase(phase: Phase): string[] {
  const map: Record<string, string[]> = {
    DISCOVERY: ["cloud_provider", "technology_stack", "auth_pattern", "business_priority"],
    CURRENT_TOPOLOGY: ["api_architecture", "integration_pattern", "deployment_model", "technology_stack"],
    DESIRED_FUTURE_STATE: ["business_priority", "scale_requirements", "governance_posture"],
    SOLUTION_DESIGN: ["migration_constraint", "team_structure", "security_requirements"],
    INFRASTRUCTURE: ["cloud_provider", "deployment_model", "security_requirements", "scale_requirements"],
    TEST_DESIGN: ["testing_maturity", "environment_topology", "ci_cd_platform"],
    CRAFT_SOLUTION: ["ci_cd_platform", "environment_topology", "technology_stack"],
    TEST_SOLUTION: ["environment_topology", "testing_maturity"],
    DEPLOYMENT_PLAN: ["deployment_model", "environment_topology", "migration_constraint", "team_structure"],
    MONITORING: ["scale_requirements", "business_priority"],
    ITERATION: ["business_priority", "governance_posture"],
  };

  return map[phase] ?? ["other"];
}
