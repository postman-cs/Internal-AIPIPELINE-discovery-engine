/**
 * Task: cascade.impactAnalysis
 *
 * Runs impact analysis for a new snapshot, marking affected phases DIRTY
 * and creating a RecomputeJob with tasks.
 * Then enqueues proposal generation.
 */

import type { Task } from "graphile-worker";

interface Payload {
  projectId: string;
  snapshotId: string;
  triggeredBy: "INGEST" | "MANUAL";
}

const task: Task = async (payload, helpers) => {
  const { projectId, snapshotId, triggeredBy } = payload as Payload;
  const { logger, addJob } = helpers;

  logger.info(`Running impact analysis for snapshot ${snapshotId}`);

  const { runImpactAnalysis } = await import("@/lib/cascade/impact");

  const result = await runImpactAnalysis(projectId, snapshotId, triggeredBy);

  logger.info(
    `Impact analysis complete: ${result.impactedPhases.length} phases impacted, ` +
    `${result.dirtyArtifacts.length} artifacts marked dirty, ` +
    `${result.virtualDirty.length} virtual dirty`
  );

  // Enqueue proposal generation
  await addJob("cascade.generateProposals", {
    jobId: result.jobId,
    projectId,
  }, {
    maxAttempts: 1, // AI calls are expensive — don't retry automatically
    queueName: `cascade-${projectId}`,
  });
};

export default task;
