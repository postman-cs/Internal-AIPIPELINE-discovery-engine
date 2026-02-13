"use server";

/**
 * Cascade Update Server Actions
 *
 * User-facing actions for the /updates UI:
 * - Trigger cascade analysis on demand
 * - Accept/reject proposals
 * - Query cascade state
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Phase } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { createEvidenceSnapshot } from "@/lib/cascade/snapshot";
import { runImpactAnalysis, markDownstreamDirty } from "@/lib/cascade/impact";
import { executeRecomputeJob } from "@/lib/cascade/recompute";
import { PHASE_GRAPH, getPhaseNode } from "@/lib/cascade/phases";
import { getVerificationSummary } from "@/lib/assumptions/engine";

// ---------------------------------------------------------------------------
// Trigger cascade update (Manual)
// ---------------------------------------------------------------------------

/**
 * Manually trigger a cascade update for a project.
 * Creates a new EvidenceSnapshot, runs impact analysis, then executes recompute.
 */
export async function triggerCascadeUpdate(
  projectId: string,
  options?: {
    /**
     * If true, the cascade will pause at each phase that has unverified
     * High-confidence assumptions. The human must verify/correct them
     * before the cascade continues to downstream phases.
     *
     * If false (default), all phases run eagerly and assumptions are
     * surfaced for review afterward.
     */
    gatedMode?: boolean;
  }
) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) return { error: "Project not found" };

  // Check if project has any evidence
  const chunkCount = await prisma.documentChunk.count({
    where: { projectId },
  });
  if (chunkCount === 0) {
    return { error: "No evidence ingested yet. Ingest data first." };
  }

  try {
    // 1. Create evidence snapshot
    const snapshot = await createEvidenceSnapshot(projectId);

    // 2. Run impact analysis (marks artifacts DIRTY, creates job + tasks)
    const impact = await runImpactAnalysis(
      projectId,
      snapshot.snapshotId,
      "MANUAL"
    );

    // 3. Execute the recompute job (runs agents, creates proposals, extracts assumptions)
    const result = await executeRecomputeJob(impact.jobId, {
      gatedMode: options?.gatedMode,
    });

    // 4. Get assumption verification summary
    const assumptionSummary = await getVerificationSummary(projectId);

    revalidatePath(`/projects/${projectId}/updates`);
    revalidatePath(`/projects/${projectId}/assumptions`);
    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      snapshotId: snapshot.snapshotId,
      jobId: impact.jobId,
      impactedPhases: impact.impactedPhases,
      completedTasks: result.completedTasks,
      proposalCount: result.proposals.length,
      errors: result.errors,
      skipped: result.skipped,
      // Assumption verification status
      assumptionSummary: {
        total: assumptionSummary.totalAssumptions,
        pending: assumptionSummary.pending,
        verified: assumptionSummary.verified,
        corrected: assumptionSummary.corrected,
        rejected: assumptionSummary.rejected,
        criticalPendingCount: assumptionSummary.criticalPending.length,
      },
      pausedAtPhase: result.pausedAtPhase,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Cascade update failed";
    return { error: msg };
  }
}

// ---------------------------------------------------------------------------
// Accept Proposal
// ---------------------------------------------------------------------------

/**
 * Accept a proposal:
 * 1. Create a new PhaseArtifact version with the proposed content
 * 2. Mark the phase CLEAN
 * 3. Mark all downstream phases DIRTY (cascade propagation)
 * 4. Update the proposal status to ACCEPTED
 */
export async function acceptProposal(proposalId: string) {
  const session = await requireAuth();

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { project: true },
  });

  if (!proposal) return { error: "Proposal not found" };
  if (proposal.project.ownerUserId !== session.userId) {
    return { error: "Unauthorized" };
  }
  if (proposal.status !== "PENDING") {
    return { error: `Proposal already ${proposal.status.toLowerCase()}` };
  }

  // Check if this is a stale placeholder
  const proposedJson = proposal.proposedJson as Record<string, unknown>;
  if (proposedJson?._placeholder) {
    return { error: "Cannot accept a stale placeholder. This phase is not implemented yet." };
  }

  try {
    // Determine next version for this phase
    const latest = await prisma.phaseArtifact.findFirst({
      where: { projectId: proposal.projectId, phase: proposal.phase },
      orderBy: { version: "desc" },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    // Create the new PhaseArtifact
    await prisma.phaseArtifact.create({
      data: {
        projectId: proposal.projectId,
        phase: proposal.phase,
        version: nextVersion,
        status: "CLEAN",
        snapshotId: proposal.snapshotId,
        derivedFromJson: {
          snapshotId: proposal.snapshotId,
          baseVersion: proposal.baseArtifactVersion,
          proposalId: proposal.id,
        } as Prisma.InputJsonValue,
        contentJson: proposal.proposedJson as Prisma.InputJsonValue,
        contentMarkdown: proposal.proposedMarkdown,
        lastComputedAt: new Date(),
      },
    });

    // Also create a DiscoveryArtifact for backward compat if this is DISCOVERY
    if (proposal.phase === "DISCOVERY") {
      await syncDiscoveryArtifact(
        proposal.projectId,
        proposedJson,
        proposal.proposedMarkdown,
        proposal.aiRunIds
      );
    }

    // Update proposal to ACCEPTED
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "ACCEPTED", resolvedAt: new Date() },
    });

    // Mark downstream phases DIRTY (cascade propagation)
    const markedDirty = await markDownstreamDirty(
      proposal.projectId,
      proposal.phase
    );

    revalidatePath(`/projects/${proposal.projectId}/updates`);
    revalidatePath(`/projects/${proposal.projectId}`);
    revalidatePath(`/projects/${proposal.projectId}/discovery`);
    revalidatePath(`/projects/${proposal.projectId}/discovery/brief`);

    return {
      success: true,
      newVersion: nextVersion,
      downstreamDirty: markedDirty,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Accept failed";
    return { error: msg };
  }
}

// ---------------------------------------------------------------------------
// Reject Proposal
// ---------------------------------------------------------------------------

/**
 * Reject a proposal:
 * 1. Mark proposal as REJECTED
 * 2. Set artifact status to CLEAN_WITH_EXCEPTIONS
 * 3. Add the snapshotId to the artifact's ignoredSnapshotIds
 *    (prevents re-prompting for the same snapshot)
 */
export async function rejectProposal(proposalId: string) {
  const session = await requireAuth();

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { project: true },
  });

  if (!proposal) return { error: "Proposal not found" };
  if (proposal.project.ownerUserId !== session.userId) {
    return { error: "Unauthorized" };
  }
  if (proposal.status !== "PENDING") {
    return { error: `Proposal already ${proposal.status.toLowerCase()}` };
  }

  try {
    // Update proposal
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "REJECTED", resolvedAt: new Date() },
    });

    // Update artifact: CLEAN_WITH_EXCEPTIONS + add ignored snapshot
    const artifact = await prisma.phaseArtifact.findFirst({
      where: { projectId: proposal.projectId, phase: proposal.phase },
      orderBy: { version: "desc" },
    });

    if (artifact) {
      const currentIgnored = (artifact.ignoredSnapshotIds as string[] | null) || [];
      const updatedIgnored = [...new Set([...currentIgnored, proposal.snapshotId])];

      await prisma.phaseArtifact.update({
        where: { id: artifact.id },
        data: {
          status: "CLEAN_WITH_EXCEPTIONS",
          ignoredSnapshotIds: updatedIgnored as Prisma.InputJsonValue,
        },
      });
    }

    revalidatePath(`/projects/${proposal.projectId}/updates`);

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Reject failed";
    return { error: msg };
  }
}

// ---------------------------------------------------------------------------
// Query actions
// ---------------------------------------------------------------------------

/**
 * Get the full cascade state for a project's /updates page.
 */
export async function getCascadeState(projectId: string) {
  const session = await requireAuth();

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) {
    return { snapshots: [], phaseGraph: [], proposals: [], pendingCount: 0, jobs: [] };
  }

  const [
    snapshots,
    artifacts,
    proposals,
    jobs,
    assumptions,
  ] = await Promise.all([
    prisma.evidenceSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.phaseArtifact.findMany({
      where: { projectId },
      orderBy: [{ phase: "asc" }, { version: "desc" }],
    }),
    prisma.proposal.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.recomputeJob.findMany({
      where: { projectId },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { tasks: true },
    }),
    prisma.assumption.findMany({
      where: { projectId },
      orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  // Build per-phase status map
  const phaseStatus = new Map<Phase, {
    latestVersion: number;
    status: string;
    snapshotId: string | null;
    lastComputedAt: Date | null;
    hasArtifact: boolean;
  }>();

  for (const a of artifacts) {
    if (!phaseStatus.has(a.phase)) {
      phaseStatus.set(a.phase, {
        latestVersion: a.version,
        status: a.status,
        snapshotId: a.snapshotId,
        lastComputedAt: a.lastComputedAt,
        hasArtifact: true,
      });
    }
  }

  // Build assumption counts per phase
  const phaseAssumptionCounts = new Map<string, { total: number; pending: number; verified: number; corrected: number; rejected: number }>();
  for (const a of assumptions) {
    const existing = phaseAssumptionCounts.get(a.phase) ?? { total: 0, pending: 0, verified: 0, corrected: 0, rejected: 0 };
    existing.total++;
    if (a.status === "PENDING") existing.pending++;
    if (a.status === "VERIFIED" || a.status === "AUTO_VERIFIED") existing.verified++;
    if (a.status === "CORRECTED") existing.corrected++;
    if (a.status === "REJECTED") existing.rejected++;
    phaseAssumptionCounts.set(a.phase, existing);
  }

  // Build phase graph view
  const phaseGraph = PHASE_GRAPH.map((node) => {
    const state = phaseStatus.get(node.phase);
    const assumptionCounts = phaseAssumptionCounts.get(node.phase);
    return {
      phase: node.phase,
      label: node.label,
      shortLabel: node.shortLabel,
      description: node.description,
      implemented: node.implemented,
      order: node.order,
      dependencies: node.dependencies,
      latestVersion: state?.latestVersion ?? 0,
      status: state?.status ?? (node.phase === "DISCOVERY" ? "DIRTY" : "STALE"),
      snapshotId: state?.snapshotId ?? null,
      lastComputedAt: state?.lastComputedAt?.toISOString() ?? null,
      hasArtifact: state?.hasArtifact ?? false,
      // Assumption verification status for this phase
      assumptions: assumptionCounts ?? { total: 0, pending: 0, verified: 0, corrected: 0, rejected: 0 },
    };
  });

  // Pending proposals
  const pendingProposals = proposals.filter((p) => p.status === "PENDING");

  // Assumption verification summary
  const totalPending = assumptions.filter((a) => a.status === "PENDING").length;
  const totalCriticalPending = assumptions.filter(
    (a) => a.status === "PENDING" && a.confidence === "High"
  ).length;

  return {
    snapshots: snapshots.map((s) => ({
      id: s.id,
      hash: s.hash,
      stats: s.countsJson as { total: number; bySource: Record<string, number> } | null,
      createdAt: s.createdAt.toISOString(),
    })),
    phaseGraph,
    proposals: proposals.map((p) => ({
      id: p.id,
      phase: p.phase,
      snapshotId: p.snapshotId,
      baseVersion: p.baseArtifactVersion,
      status: p.status,
      diffSummary: p.diffSummary,
      proposedMarkdown: p.proposedMarkdown,
      patchOps: (p.patchJson as unknown[])?.length ?? 0,
      createdAt: p.createdAt.toISOString(),
      resolvedAt: p.resolvedAt?.toISOString() ?? null,
    })),
    pendingCount: pendingProposals.length,
    jobs: jobs.map((j) => ({
      id: j.id,
      triggeredBy: j.triggeredBy,
      snapshotId: j.snapshotId,
      status: j.status,
      startedAt: j.startedAt.toISOString(),
      finishedAt: j.finishedAt?.toISOString() ?? null,
      taskCount: j.tasks.length,
      completedTasks: j.tasks.filter((t) => t.status === "COMPLETED").length,
      failedTasks: j.tasks.filter((t) => t.status === "FAILED").length,
    })),
    // Assumption verification health
    assumptionHealth: {
      totalAssumptions: assumptions.length,
      pendingVerification: totalPending,
      criticalPending: totalCriticalPending,
      allClear: totalCriticalPending === 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sync the cascade PhaseArtifact acceptance into the legacy DiscoveryArtifact
 * table for backward compatibility with the existing brief viewer.
 */
async function syncDiscoveryArtifact(
  projectId: string,
  proposedJson: Record<string, unknown>,
  markdown: string | null,
  aiRunIds: unknown
) {
  const latest = await prisma.discoveryArtifact.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const snapshot = proposedJson;
  const company = (snapshot.companySnapshot ?? {}) as Record<string, unknown>;
  const signals = (snapshot.signals ?? []) as Array<Record<string, unknown>>;
  const maturity = (snapshot.maturity ?? {}) as Record<string, unknown>;
  const foot = (snapshot.publicFootprint ?? {}) as Record<string, unknown>;
  const hyp = (snapshot.hypothesis ?? {}) as Record<string, unknown>;
  const matMeta = (snapshot.maturityMeta ?? {}) as Record<string, unknown>;

  await prisma.discoveryArtifact.create({
    data: {
      projectId,
      version: nextVersion,
      industry: (company.industry as string) ?? null,
      engineeringSize: (company.engineeringSize as string) ?? null,
      publicApiPresence: (company.publicApiPresence as string) ?? null,
      dnsFindings: signals
        .map((s) => `${s.signalType}: ${s.finding} (${s.confidence})`)
        .join("\n"),
      technicalLandscapeJson: JSON.stringify(signals),
      maturityLevel: (maturity.level as number) ?? null,
      maturityJustification: (maturity.justification as string) ?? null,
      confidenceJson: JSON.stringify(matMeta.confidenceBySignal ?? {}),
      publicFootprint: (foot.postmanNetwork as string) ?? null,
      cloudGatewaySignals: (foot.githubPresence as string) ?? null,
      developerFrictionSignals: (foot.developerPortal as string) ?? null,
      hypothesis: (hyp.text as string) ?? null,
      recommendedApproach: (hyp.recommendedApproach as string) ?? null,
      conversationAngle: (hyp.conversationAngle as string) ?? null,
      stakeholderTargetsJson: JSON.stringify(snapshot.stakeholderTargets ?? []),
      firstMeetingAgendaJson: JSON.stringify(snapshot.firstMeetingAgenda ?? []),
      generatedBriefMarkdown: markdown,
      generatedBriefJson: JSON.stringify(snapshot),
      aiGenerated: true,
      aiRunIds: aiRunIds as Prisma.InputJsonValue,
      evidenceCitations: (snapshot.citations ?? []) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get a single proposal with its full patch detail.
 */
export async function getProposalDetail(proposalId: string) {
  const session = await requireAuth();

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) return null;

  // Verify the user owns the project this proposal belongs to
  const project = await prisma.project.findFirst({
    where: { id: proposal.projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return null;

  // Get the base artifact to show "before" state
  const baseArtifact = await prisma.phaseArtifact.findFirst({
    where: {
      projectId: proposal.projectId,
      phase: proposal.phase,
      version: proposal.baseArtifactVersion,
    },
  });

  const node = getPhaseNode(proposal.phase);

  return {
    id: proposal.id,
    phase: proposal.phase,
    phaseLabel: node.label,
    snapshotId: proposal.snapshotId,
    baseVersion: proposal.baseArtifactVersion,
    status: proposal.status,
    diffSummary: proposal.diffSummary,
    patchJson: proposal.patchJson,
    proposedMarkdown: proposal.proposedMarkdown,
    baseMarkdown: baseArtifact?.contentMarkdown ?? null,
    baseJson: baseArtifact?.contentJson ?? null,
    proposedJson: proposal.proposedJson,
    createdAt: proposal.createdAt.toISOString(),
    resolvedAt: proposal.resolvedAt?.toISOString() ?? null,
  };
}
