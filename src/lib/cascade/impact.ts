import { prisma } from "@/lib/prisma";
import { Phase, ArtifactStatus } from "@prisma/client";
import { getDownstream, PHASE_GRAPH, getAllPhasesOrdered } from "./phases";
import type { Prisma } from "@prisma/client";

export interface ImpactResult {
  jobId: string;
  snapshotId: string;
  impactedPhases: Phase[];
  dirtyArtifacts: Array<{ phase: Phase; version: number }>;
  virtualDirty: Phase[];
}

export async function runImpactAnalysis(
  projectId: string,
  snapshotId: string,
  triggeredBy: "INGEST" | "MANUAL" | "WEBHOOK"
): Promise<ImpactResult> {
  const latestArtifacts = await getLatestArtifactPerPhase(projectId);

  const impactedPhases = new Set<Phase>(["DISCOVERY"]);

  const downstream = getDownstream("DISCOVERY");
  for (const phase of downstream) {
    impactedPhases.add(phase);
  }

  const filteredPhases: Phase[] = [];
  for (const phase of impactedPhases) {
    const artifact = latestArtifacts.get(phase);
    if (artifact) {
      const ignored = (artifact.ignoredSnapshotIds as string[] | null) || [];
      if (ignored.includes(snapshotId)) {
        continue;
      }
    }
    filteredPhases.push(phase);
  }

  const allOrdered = getAllPhasesOrdered();
  filteredPhases.sort((a, b) => allOrdered.indexOf(a) - allOrdered.indexOf(b));

  const { dirtyArtifacts, virtualDirty } = await markPhasesDirty(latestArtifacts, filteredPhases);

  const job = await createRecomputeJobWithTasks(
    projectId, triggeredBy, snapshotId, filteredPhases, latestArtifacts
  );

  return {
    jobId: job.id,
    snapshotId,
    impactedPhases: filteredPhases,
    dirtyArtifacts,
    virtualDirty,
  };
}

export async function runSelectiveImpactAnalysis(
  projectId: string,
  snapshotId: string,
  triggeredBy: "INGEST" | "MANUAL",
  fromPhase: Phase
): Promise<ImpactResult> {
  const latestArtifacts = await getLatestArtifactPerPhase(projectId);

  const impactedPhases = new Set<Phase>([fromPhase]);
  const downstream = getDownstream(fromPhase);
  for (const phase of downstream) {
    impactedPhases.add(phase);
  }

  const filteredPhases: Phase[] = [];
  for (const phase of impactedPhases) {
    const artifact = latestArtifacts.get(phase);
    if (artifact) {
      const ignored = (artifact.ignoredSnapshotIds as string[] | null) || [];
      if (ignored.includes(snapshotId)) {
        continue;
      }
    }
    filteredPhases.push(phase);
  }

  const allOrdered = getAllPhasesOrdered();
  filteredPhases.sort((a, b) => allOrdered.indexOf(a) - allOrdered.indexOf(b));

  const { dirtyArtifacts, virtualDirty } = await markPhasesDirty(latestArtifacts, filteredPhases);

  const job = await createRecomputeJobWithTasks(
    projectId, triggeredBy, snapshotId, filteredPhases, latestArtifacts
  );

  return {
    jobId: job.id,
    snapshotId,
    impactedPhases: filteredPhases,
    dirtyArtifacts,
    virtualDirty,
  };
}

async function markPhasesDirty(
  latestArtifacts: LatestArtifactMap,
  phases: Phase[]
): Promise<{ dirtyArtifacts: Array<{ phase: Phase; version: number }>; virtualDirty: Phase[] }> {
  const dirtyArtifacts: Array<{ phase: Phase; version: number }> = [];
  const virtualDirty: Phase[] = [];

  for (const phase of phases) {
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

  return { dirtyArtifacts, virtualDirty };
}

async function createRecomputeJobWithTasks(
  projectId: string,
  triggeredBy: string,
  snapshotId: string,
  phases: Phase[],
  latestArtifacts: LatestArtifactMap
) {
  const job = await prisma.recomputeJob.create({
    data: {
      projectId,
      triggeredBy,
      snapshotId,
      status: "PENDING",
    },
  });

  for (const phase of phases) {
    const artifact = latestArtifacts.get(phase);
    const upstreamVersions: Record<string, number> = {};

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

  return job;
}

type LatestArtifactMap = Map<
  Phase,
  { id: string; version: number; status: ArtifactStatus; snapshotId: string | null; ignoredSnapshotIds: unknown }
>;

async function getLatestArtifactPerPhase(projectId: string): Promise<LatestArtifactMap> {
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

  const map: LatestArtifactMap = new Map();
  for (const a of artifacts) {
    if (!map.has(a.phase)) {
      map.set(a.phase, a);
    }
  }

  return map;
}

export async function getLatestPhaseArtifact(projectId: string, phase: Phase) {
  return prisma.phaseArtifact.findFirst({
    where: { projectId, phase },
    orderBy: { version: "desc" },
  });
}

export async function markDownstreamDirty(projectId: string, phase: Phase): Promise<Phase[]> {
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
