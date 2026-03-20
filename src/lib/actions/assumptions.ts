"use server";

/**
 * Human Assumption Verification — Server Actions
 *
 * User-facing actions for the assumption verification workflow:
 * - View assumptions per phase and across the project
 * - Verify, correct, or reject individual assumptions
 * - Bulk-verify all assumptions for a phase
 * - Get verification summary / health check
 * - Resume cascade after verification (re-trigger from a paused phase)
 *
 * This is the bridge between the AI pipeline and the human operator,
 * ensuring the engagement stays on the golden happy path.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Phase } from "@prisma/client";
import {
  verifyAssumption,
  correctAssumption,
  rejectAssumption,
  bulkVerifyPhaseAssumptions,
  getPhaseCheckpoint,
  getVerificationSummary,
  isPhaseGateClear,
} from "@/lib/assumptions/engine";
import { markDownstreamDirty } from "@/lib/cascade/impact";

// ---------------------------------------------------------------------------
// Get assumptions for a project (all phases or specific phase)
// ---------------------------------------------------------------------------

/**
 * Retrieve all assumptions for a project, grouped by phase.
 * Used for the verification dashboard.
 */
export async function getProjectAssumptions(
  projectId: string,
  options?: { phase?: Phase; statusFilter?: string }
) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found", assumptions: [], summary: null };

  const where: Record<string, unknown> = { projectId };
  if (options?.phase) where.phase = options.phase;
  if (options?.statusFilter && options.statusFilter !== "ALL") {
    where.status = options.statusFilter;
  }

  const assumptions = await prisma.assumption.findMany({
    where,
    orderBy: [{ phase: "asc" }, { confidence: "asc" }, { createdAt: "asc" }],
  });

  const summary = await getVerificationSummary(projectId);

  return {
    assumptions: assumptions.map((a) => ({
      id: a.id,
      phase: a.phase,
      category: a.category,
      claim: a.claim,
      reasoning: a.reasoning,
      confidence: a.confidence,
      impact: a.impact,
      status: a.status,
      humanResponse: a.humanResponse,
      verifiedBy: a.verifiedBy,
      verifiedAt: a.verifiedAt?.toISOString() ?? null,
      evidenceIds: Array.isArray(a.evidenceIds) ? (a.evidenceIds as string[]) : [],
      blocksPhases: Array.isArray(a.blocksPhases) ? (a.blocksPhases as string[]) : [],
      createdAt: a.createdAt.toISOString(),
    })),
    summary,
  };
}

// ---------------------------------------------------------------------------
// Get checkpoint for a specific phase
// ---------------------------------------------------------------------------

/**
 * Get the assumption verification checkpoint for a specific phase.
 * Shows what needs to be verified before the next phase can proceed.
 */
export async function getPhaseAssumptionCheckpoint(
  projectId: string,
  phase: Phase
) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  const checkpoint = await getPhaseCheckpoint(projectId, phase);
  const gate = await isPhaseGateClear(projectId, phase);

  return {
    checkpoint,
    gate,
  };
}

// ---------------------------------------------------------------------------
// Verify (confirm) an assumption
// ---------------------------------------------------------------------------

/**
 * Human confirms an assumption is correct. The AI got it right.
 */
export async function confirmAssumption(assumptionId: string) {
  const session = await requireAuth();

  // Verify ownership
  const assumption = await prisma.assumption.findUnique({
    where: { id: assumptionId },
    include: { project: true },
  });
  if (!assumption) return { error: "Assumption not found" };
  if (assumption.project.ownerUserId !== session.userId) {
    return { error: "Unauthorized" };
  }

  const result = await verifyAssumption(assumptionId, session.userId);

  if (result.success) {
    import("@/lib/gamification/xp-engine").then(({ awardXp, XP_ACTIONS }) => {
      awardXp(session.userId, XP_ACTIONS.ASSUMPTION_VERIFIED.action, XP_ACTIONS.ASSUMPTION_VERIFIED.points, assumption.projectId).catch(() => {});
    }).catch(() => {});

    revalidatePath(`/projects/${assumption.projectId}/assumptions`);
    revalidatePath(`/projects/${assumption.projectId}/updates`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Correct an assumption (human provides the right answer)
// ---------------------------------------------------------------------------

/**
 * Human corrects an assumption — provides what the real answer is.
 * This is the most powerful action: corrections flow back as constraints
 * into downstream agents. If the correction invalidates downstream phases,
 * those phases are marked DIRTY for re-computation.
 */
export async function correctAssumptionAction(
  assumptionId: string,
  correction: string
) {
  const session = await requireAuth();

  const assumption = await prisma.assumption.findUnique({
    where: { id: assumptionId },
    include: { project: true },
  });
  if (!assumption) return { error: "Assumption not found" };
  if (assumption.project.ownerUserId !== session.userId) {
    return { error: "Unauthorized" };
  }

  if (!correction.trim()) {
    return { error: "Correction text is required" };
  }

  const result = await correctAssumption(assumptionId, session.userId, correction);

  if (result.success && result.invalidatedPhases?.length) {
    // Mark downstream phases DIRTY so they'll be re-run with the corrected constraint
    for (const phase of result.invalidatedPhases) {
      await markDownstreamDirty(assumption.projectId, phase);
    }
  }

  if (result.success) {
    revalidatePath(`/projects/${assumption.projectId}/assumptions`);
    revalidatePath(`/projects/${assumption.projectId}/updates`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Reject an assumption
// ---------------------------------------------------------------------------

/**
 * Human rejects an assumption entirely — the AI got this completely wrong.
 * Optionally provide a reason. Downstream phases that depend on this
 * assumption will be marked DIRTY.
 */
export async function rejectAssumptionAction(
  assumptionId: string,
  reason?: string
) {
  const session = await requireAuth();

  const assumption = await prisma.assumption.findUnique({
    where: { id: assumptionId },
    include: { project: true },
  });
  if (!assumption) return { error: "Assumption not found" };
  if (assumption.project.ownerUserId !== session.userId) {
    return { error: "Unauthorized" };
  }

  const result = await rejectAssumption(assumptionId, session.userId, reason);

  if (result.success && result.invalidatedPhases?.length) {
    for (const phase of result.invalidatedPhases) {
      await markDownstreamDirty(assumption.projectId, phase);
    }
  }

  if (result.success) {
    revalidatePath(`/projects/${assumption.projectId}/assumptions`);
    revalidatePath(`/projects/${assumption.projectId}/updates`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Bulk verify all assumptions for a phase
// ---------------------------------------------------------------------------

/**
 * Fast-track: verify all pending assumptions for a phase at once.
 * Use when the human reviews the phase output and confirms everything looks right.
 */
export async function bulkVerifyPhaseAction(projectId: string, phase: Phase) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  const result = await bulkVerifyPhaseAssumptions(projectId, phase, session.userId);

  revalidatePath(`/projects/${projectId}/assumptions`);
  revalidatePath(`/projects/${projectId}/updates`);

  return { success: true, verified: result.verified };
}

// ---------------------------------------------------------------------------
// Resume cascade after verification
// ---------------------------------------------------------------------------

/**
 * After the human has verified/corrected assumptions at a checkpoint,
 * resume the cascade from the paused phase forward.
 * This re-triggers the cascade analysis for downstream phases
 * that were waiting on assumption verification.
 */
export async function resumeCascadeAfterVerification(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, name: true },
  });
  if (!project) return { error: "Project not found" };

  // Find the most recent paused recompute job
  const pausedJob = await prisma.recomputeJob.findFirst({
    where: {
      projectId,
      status: "PAUSED_FOR_VERIFICATION",
    },
    orderBy: { startedAt: "desc" },
    include: { tasks: true },
  });

  if (pausedJob) {
    // Check if all critical assumptions are now verified
    const summary = await getVerificationSummary(projectId);
    if (summary.criticalPending.length > 0) {
      return {
        error: `${summary.criticalPending.length} critical assumption(s) still need verification before the cascade can resume.`,
        criticalPending: summary.criticalPending,
      };
    }

    // Reset the paused job's skipped tasks back to PENDING
    const skippedTasks = pausedJob.tasks.filter(
      (t) => t.status === "SKIPPED" && t.message?.includes("assumption verification")
    );

    for (const task of skippedTasks) {
      await prisma.recomputeTask.update({
        where: { id: task.id },
        data: { status: "PENDING", message: null, finishedAt: null },
      });
    }

    try {
      const { executeRecomputeJob } = await import("@/lib/cascade/recompute");
      const result = await executeRecomputeJob(pausedJob.id, { gatedMode: true });

      revalidatePath(`/projects/${projectId}/updates`);
      revalidatePath(`/projects/${projectId}/assumptions`);

      return {
        success: true,
        completedTasks: result.completedTasks,
        proposalCount: result.proposals.length,
        pausedAtPhase: result.pausedAtPhase,
        errors: result.errors,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to resume paused cascade" };
    }
  }

  // No paused job — trigger a fresh cascade for any DIRTY phases
  try {
    const { triggerCascadeUpdate } = await import("@/lib/actions/cascade");
    const result = await triggerCascadeUpdate(projectId);

    revalidatePath(`/projects/${projectId}/updates`);
    revalidatePath(`/projects/${projectId}/assumptions`);

    if ("error" in result && result.error) {
      return { error: result.error };
    }

    return {
      success: true,
      jobId: "jobId" in result ? result.jobId : undefined,
      impactedPhases: "impactedPhases" in result ? (result.impactedPhases as string[]).length : 0,
      async: true,
      message: "No paused job found — triggered a fresh cascade update.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to trigger cascade" };
  }
}

// ---------------------------------------------------------------------------
// Verification health check
// ---------------------------------------------------------------------------

/**
 * Quick health check: are there unverified critical assumptions
 * that could block the cascade?
 */
export async function getAssumptionHealthCheck(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  const summary = await getVerificationSummary(projectId);
  const healthy = summary.criticalPending.length === 0;

  return {
    healthy,
    summary,
    message: healthy
      ? "All critical assumptions verified. Pipeline is on the golden path."
      : `${summary.criticalPending.length} critical assumption(s) need human verification.`,
  };
}
