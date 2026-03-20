/**
 * Task: snapshot.createEvidenceSnapshot
 *
 * Creates an immutable EvidenceSnapshot for a project,
 * then enqueues cascade impact analysis.
 */

import type { Task } from "graphile-worker";

interface Payload {
  projectId: string;
  triggeredBy?: string;
}

const task: Task = async (payload, helpers) => {
  const { projectId, triggeredBy } = payload as Payload;
  const { logger, addJob } = helpers;

  logger.info(`Creating evidence snapshot for project ${projectId}`);

  const { createEvidenceSnapshot, getLatestSnapshot } = await import("@/lib/cascade/snapshot");

  // Check if evidence actually changed
  const previousSnapshot = await getLatestSnapshot(projectId);
  const newSnapshot = await createEvidenceSnapshot(projectId);

  if (previousSnapshot && previousSnapshot.hash === newSnapshot.hash) {
    logger.info("Evidence unchanged, skipping cascade");
    return;
  }

  logger.info(`New snapshot ${newSnapshot.snapshotId} created (hash: ${newSnapshot.hash.slice(0, 12)}...)`);

  const { PRIORITY } = await import("@/worker/index");

  await addJob("cascade.impactAnalysis", {
    projectId,
    snapshotId: newSnapshot.snapshotId,
    triggeredBy: triggeredBy || "INGEST",
  }, {
    maxAttempts: 2,
    queueName: `cascade-${projectId}`,
    priority: PRIORITY.CRITICAL,
  });
};

export default task;
