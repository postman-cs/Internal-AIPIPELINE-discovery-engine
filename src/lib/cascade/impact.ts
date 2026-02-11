/**
 * Impact Analysis Engine
 *
 * Determines which phases are affected when evidence changes,
 * and transitions artifact statuses accordingly.
 *
 * Rules:
 * - DISCOVERY is ALWAYS impacted by new evidence.
 * - Downstream phases are impacted if:
 *   a) They have an artifact that references an upstream version that changed
 *   b) Their snapshot hash differs from the new snapshot
 *   c) They are downstream of any DIRTY phase (transitive cascade)
 * - Phases with no artifact yet are "virtually DIRTY" — they get tracked
 *   in RecomputeTask but don't have a PhaseArtifact row to update.
 *
 * The impact analysis does NOT run recompute — it only marks artifacts DIRTY
 * and creates a RecomputeJob with tasks for the user to trigger.
 */

import { prisma } from "@/lib/prisma";
import { Phase, ArtifactStatus } from "@prisma/client";
import { getDownstream, PHASE_GRAPH, getAllPhasesOrdered } from "./phases";
import type { Prisma } from "@prisma/client";

export interface ImpactResult {
  jobId: string;
  snapshotId: string;
  impactedPhases: Phase[];
  dirtyArtifacts: Array<{ phase: Phase; version: number }>;
  virtualDirty: Phase[]; // phases with no artifact yet
}

/**
 * Run impact analysis after a new EvidenceSnapshot is created.
 *
 * 1. Mark Discovery DIRTY (always)
 * 2. Transitively mark all downstream phases DIRTY
 * 3. Create a RecomputeJob with tasks for each impacted phase
 * 4. Skip phases whose latest artifact already has this snapshotId in ignoredSnapshotIds
 */
export async function runImpactAnalysis(
  projectId: string,
  snapshotId: string,
  triggeredBy: "INGEST" | "MANUAL"
): Promise<ImpactResult> {
  // Get latest artifact for each phase
  const latestArtifacts = await getLatestArtifactPerPhase(projectId);

  // Discovery is always impacted
  const impactedPhases = new Set<Phase>(["DISCOVERY"]);

  // All phases downstream of Discovery are also impacted
  const downstream = getDownstream("DISCOVERY");
  for (const phase of downstream) {
    impactedPhases.add(phase);
  }

  // Filter out phases that have this snapshot in their ignored list
  const filteredPhases: Phase[] = [];
  for (const phase of impactedPhases) {
    const artifact = latestArtifacts.get(phase);
    if (artifact) {
      const ignored = (artifact.ignoredSnapshotIds as string[] | null) || [];
      if (ignored.includes(snapshotId)) {
        continue; // Skip — user already rejected this snapshot for this phase
      }
    }
    filteredPhases.push(phase);
  }

  // Sort by topological order
  const allOrdered = getAllPhasesOrdered();
  filteredPhases.sort(
    (a, b) => allOrdered.indexOf(a) - allOrdered.indexOf(b)
  );

  // Mark existing artifacts DIRTY
  const dirtyArtifacts: Array<{ phase: Phase; version: number }> = [];
  const virtualDirty: Phase[] = [];

  for (const phase of filteredPhases) {
    const artifact = latestArtifacts.get(phase);
    if (artifact && artifact.status !== "DIRTY" && artifact.status !== "NEEDS_REVIEW") {
      await prisma.phaseArtifact.update({
        where: { id: artifact.id },
        data: { status: "DIRTY" },
      });
      dirtyArtifacts.push({ phase, version: artifact.version });
    } else if (!artifact) {
      virtualDirty.push(phase);
    }
  }

  // Create RecomputeJob
  const job = await prisma.recomputeJob.create({
    data: {
      projectId,
      triggeredBy,
      snapshotId,
      status: "PENDING",
    },
  });

  // Create RecomputeTask for each impacted phase
  for (const phase of filteredPhases) {
    const artifact = latestArtifacts.get(phase);
    const upstreamVersions: Record<string, number> = {};

    // Resolve upstream versions
    const node = PHASE_GRAPH.find((n) => n.phase === phase);
    if (node) {
      for (const dep of node.dependencies) {
        const depArtifact = latestArtifacts.get(dep);
        if (depArtifact) {
          upstreamVersions[dep] = depArtifact.version;
        }
      }
    }

    await prisma.recomputeTask.create({
      data: {
        jobId: job.id,
        phase,
        status: "PENDING",
        inputRefsJson: {
          upstreamVersions,
          snapshotId,
          baseVersion: artifact?.version ?? 0,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return {
    jobId: job.id,
    snapshotId,
    impactedPhases: filteredPhases,
    dirtyArtifacts,
    virtualDirty,
  };
}

/**
 * Get the latest PhaseArtifact for each phase in a project.
 */
async function getLatestArtifactPerPhase(
  projectId: string
): Promise<Map<Phase, { id: string; version: number; status: ArtifactStatus; snapshotId: string | null; ignoredSnapshotIds: unknown }>> {
  // Get all artifacts, grouped by phase, latest version first
  const artifacts = await prisma.phaseArtifact.findMany({
    where: { projectId },
    orderBy: [{ phase: "asc" }, { version: "desc" }],
    select: {
      id: true,
      phase: true,
      version: true,
      status: true,
      snapshotId: true,
      ignoredSnapshotIds: true,
    },
  });

  const map = new Map<Phase, { id: string; version: number; status: ArtifactStatus; snapshotId: string | null; ignoredSnapshotIds: unknown }>();
  for (const a of artifacts) {
    if (!map.has(a.phase)) {
      map.set(a.phase, a);
    }
  }

  return map;
}

/**
 * Get the latest PhaseArtifact for a specific phase.
 */
export async function getLatestPhaseArtifact(
  projectId: string,
  phase: Phase
) {
  return prisma.phaseArtifact.findFirst({
    where: { projectId, phase },
    orderBy: { version: "desc" },
  });
}

/**
 * Mark downstream phases DIRTY after an artifact is accepted.
 * This propagates the cascade.
 */
export async function markDownstreamDirty(
  projectId: string,
  phase: Phase
): Promise<Phase[]> {
  const downstream = getDownstream(phase);
  const marked: Phase[] = [];

  for (const dp of downstream) {
    const artifact = await prisma.phaseArtifact.findFirst({
      where: { projectId, phase: dp },
      orderBy: { version: "desc" },
    });

    if (artifact && artifact.status === "CLEAN") {
      await prisma.phaseArtifact.update({
        where: { id: artifact.id },
        data: { status: "DIRTY" },
      });
      marked.push(dp);
    }
  }

  return marked;
}
