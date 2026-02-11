/**
 * Task: iteration.createNextActions
 *
 * Triggered after monitoring signal evaluation detects changes.
 * Creates a new cascade snapshot and triggers recompute for ITERATION phase.
 */

import type { Task } from "graphile-worker";

interface Payload {
  projectId: string;
  reason: string;
}

const task: Task = async (payload, helpers) => {
  const { projectId, reason } = payload as Payload;
  const { logger, addJob } = helpers;

  logger.info(`Creating iteration actions for project ${projectId}: ${reason}`);

  // Trigger a cascade update which will recompute ITERATION if MONITORING is CLEAN
  await addJob("snapshot.createEvidenceSnapshot", {
    projectId,
    triggeredBy: "MONITOR",
  }, {
    maxAttempts: 2,
    queueName: `cascade-${projectId}`,
  });

  logger.info("Iteration action creation enqueued");
};

export default task;
