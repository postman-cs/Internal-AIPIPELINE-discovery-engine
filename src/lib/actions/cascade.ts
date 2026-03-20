"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Phase } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { createEvidenceSnapshot } from "@/lib/cascade/snapshot";
import { runImpactAnalysis, runSelectiveImpactAnalysis, markDownstreamDirty } from "@/lib/cascade/impact";
import { executeRecomputeJob } from "@/lib/cascade/recompute";
import { PHASE_GRAPH, getPhaseNode } from "@/lib/cascade/phases";
import { getVerificationSummary } from "@/lib/assumptions/engine";
import { logAudit } from "@/lib/audit";

export async function triggerCascadeUpdate(
  projectId: string,
  options?: {
    gatedMode?: boolean;
  }
) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) return { error: "Project not found" };

  const chunkCount = await prisma.documentChunk.count({
    where: { projectId },
  });
  if (chunkCount === 0) {
    return { error: "No evidence ingested yet. Ingest data first." };
  }

  try {
    const snapshot = await createEvidenceSnapshot(projectId);

    const impact = await runImpactAnalysis(
      projectId,
      snapshot.snapshotId,
      "MANUAL"
    );

    const gatedMode = options?.gatedMode ?? false;

    logAudit({
      userId: session.userId,
      action: "CASCADE_TRIGGER",
      targetId: projectId,
      targetType: "Project",
      metadata: { snapshotId: snapshot.snapshotId, jobId: impact.jobId, gatedMode },
    }).catch(() => {});

    // XP: award points for running a cascade
    import("@/lib/gamification/xp-engine").then(({ awardXp, XP_ACTIONS }) => {
      awardXp(session.userId, XP_ACTIONS.CASCADE_RUN.action, XP_ACTIONS.CASCADE_RUN.points, projectId).catch(() => {});
    }).catch(() => {});

    void (async () => {
      try {
        await executeRecomputeJob(impact.jobId, {
          gatedMode,
          autoAccept: true,
        });

        syncProjectToJira(projectId, session.userId, "Cascade update completed — all phases recomputed");

        revalidatePath(`/projects/${projectId}/updates`);
        revalidatePath(`/projects/${projectId}/assumptions`);
        revalidatePath(`/projects/${projectId}`);
      } catch (err) {
        console.error("[cascade] Async recompute failed:", err);
        await prisma.recomputeJob.update({
          where: { id: impact.jobId },
          data: {
            status: "COMPLETED_WITH_ERRORS",
            finishedAt: new Date(),
          },
        }).catch(() => {});
      }
    })();

    const assumptionSummary = gatedMode
      ? await getVerificationSummary(projectId)
      : null;

    return {
      success: true,
      snapshotId: snapshot.snapshotId,
      jobId: impact.jobId,
      impactedPhases: impact.impactedPhases,
      async: true,
      ...(gatedMode && assumptionSummary
        ? {
            gatedVerification: {
              total: assumptionSummary.totalAssumptions,
              pending: assumptionSummary.pending,
              verified: assumptionSummary.verified,
              corrected: assumptionSummary.corrected,
              rejected: assumptionSummary.rejected,
              criticalPendingCount: assumptionSummary.criticalPending.length,
              criticalPending: assumptionSummary.criticalPending.map((a) => ({
                id: a.id,
                category: a.category,
                claim: a.claim,
                impact: a.impact,
                blocksPhases: a.blocksPhases,
              })),
            },
          }
        : {}),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Cascade update failed";
    return { error: msg };
  }
}

export async function triggerSelectiveRecompute(
  projectId: string,
  fromPhase: Phase
) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) return { error: "Project not found" };

  const chunkCount = await prisma.documentChunk.count({
    where: { projectId },
  });
  if (chunkCount === 0) {
    return { error: "No evidence ingested yet. Ingest data first." };
  }

  try {
    const snapshot = await createEvidenceSnapshot(projectId);

    const impact = await runSelectiveImpactAnalysis(
      projectId,
      snapshot.snapshotId,
      "MANUAL",
      fromPhase
    );

    void (async () => {
      try {
        await executeRecomputeJob(impact.jobId, {
          autoAccept: true,
        });

        syncProjectToJira(projectId, session.userId, `Selective recompute completed from ${fromPhase}`);

        revalidatePath(`/projects/${projectId}/updates`);
        revalidatePath(`/projects/${projectId}/assumptions`);
        revalidatePath(`/projects/${projectId}`);
      } catch (err) {
        console.error("[cascade] Async selective recompute failed:", err);
        await prisma.recomputeJob.update({
          where: { id: impact.jobId },
          data: {
            status: "COMPLETED_WITH_ERRORS",
            finishedAt: new Date(),
          },
        }).catch(() => {});
      }
    })();

    return {
      success: true,
      jobId: impact.jobId,
      snapshotId: snapshot.snapshotId,
      impactedPhases: impact.impactedPhases,
      async: true,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Selective recompute failed";
    return { error: msg };
  }
}

export async function applyProposal(
  proposalId: string,
  opts?: { skipMarkDirty?: boolean }
): Promise<{ newVersion: number }> {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw new Error("Proposal not found");

  const proposedJson = proposal.proposedJson as Record<string, unknown>;
  if (proposedJson?._placeholder) {
    throw new Error("Cannot apply a stale placeholder.");
  }

  const latest = await prisma.phaseArtifact.findFirst({
    where: { projectId: proposal.projectId, phase: proposal.phase },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

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

  if (proposal.phase === "DISCOVERY") {
    await syncDiscoveryArtifact(
      proposal.projectId,
      proposedJson,
      proposal.proposedMarkdown,
      proposal.aiRunIds
    );
  }

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: "ACCEPTED", resolvedAt: new Date() },
  });

  if (!opts?.skipMarkDirty) {
    await markDownstreamDirty(proposal.projectId, proposal.phase);
  }

  return { newVersion: nextVersion };
}

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

  try {
    const { newVersion } = await applyProposal(proposalId);

    logAudit({
      userId: session.userId,
      action: "PROPOSAL_ACCEPT",
      targetId: proposalId,
      targetType: "Proposal",
      metadata: { phase: proposal.phase, projectId: proposal.projectId, newVersion },
    }).catch(() => {});

    syncProjectToJira(
      proposal.projectId,
      session.userId,
      `Proposal accepted for ${proposal.phase} — now at v${newVersion}`,
    );

    revalidatePath(`/projects/${proposal.projectId}/updates`);
    revalidatePath(`/projects/${proposal.projectId}`);
    revalidatePath(`/projects/${proposal.projectId}/discovery`);
    revalidatePath(`/projects/${proposal.projectId}/discovery/brief`);

    return { success: true, newVersion, downstreamDirty: [] as string[] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Accept failed";
    return { error: msg };
  }
}

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
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "REJECTED", resolvedAt: new Date() },
    });

    logAudit({
      userId: session.userId,
      action: "PROPOSAL_REJECT",
      targetId: proposalId,
      targetType: "Proposal",
      metadata: { phase: proposal.phase, projectId: proposal.projectId },
    }).catch(() => {});

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

    syncProjectToJira(
      proposal.projectId,
      session.userId,
      `Proposal rejected for ${proposal.phase}`,
    );

    revalidatePath(`/projects/${proposal.projectId}/updates`);

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Reject failed";
    return { error: msg };
  }
}

export async function getCascadeState(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, serviceTemplateContent: true },
  });
  if (!project) {
    return { snapshots: [], phaseGraph: [], proposals: [], pendingCount: 0, jobs: [], hasServiceTemplate: false };
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
      assumptions: assumptionCounts ?? { total: 0, pending: 0, verified: 0, corrected: 0, rejected: 0 },
    };
  });

  const pendingProposals = proposals.filter((p) => p.status === "PENDING");

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
    assumptionHealth: {
      totalAssumptions: assumptions.length,
      pendingVerification: totalPending,
      criticalPending: totalCriticalPending,
      allClear: totalCriticalPending === 0,
    },
    hasServiceTemplate: !!project.serviceTemplateContent,
  };
}

/** @deprecated Use phase artifact system directly. Toggle with LEGACY_DISCOVERY_SYNC env var. */
async function syncDiscoveryArtifact(
  projectId: string,
  proposedJson: Record<string, unknown>,
  markdown: string | null,
  aiRunIds: unknown
) {
  if (process.env.LEGACY_DISCOVERY_SYNC === "false") {
    console.warn("[cascade] syncDiscoveryArtifact is deprecated and disabled via LEGACY_DISCOVERY_SYNC=false");
    return;
  }

  console.warn("[cascade] syncDiscoveryArtifact is deprecated. Set LEGACY_DISCOVERY_SYNC=false to disable.");

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

function syncProjectToJira(projectId: string, userId: string, event?: string) {
  import("@/lib/jira/client")
    .then(({ syncJiraDescription }) =>
      syncJiraDescription(projectId, userId, event),
    )
    .catch((err) =>
      console.warn("[cascade] Jira sync failed (non-blocking):", err),
    );
}

export async function getProposalDetail(proposalId: string) {
  const session = await requireAuth();

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) return null;

  const project = await prisma.project.findFirst({
    where: { id: proposal.projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return null;

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
