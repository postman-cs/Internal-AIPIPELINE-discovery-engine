/**
 * Task: cascade.generateProposals
 *
 * Executes the recompute job: runs AI agents for each DIRTY phase
 * in topological order, generating proposals.
 */

import type { Task } from "graphile-worker";

interface Payload {
  jobId: string;
  projectId: string;
}

const task: Task = async (payload, helpers) => {
  const { jobId, projectId } = payload as Payload;
  const { logger } = helpers;

  logger.info(`Executing recompute job ${jobId}`);

  const { executeRecomputeJob } = await import("@/lib/cascade/recompute");

  const result = await executeRecomputeJob(jobId);

  logger.info(
    `Recompute complete: ${result.completedTasks} tasks, ` +
    `${result.proposals.length} proposals, ` +
    `${result.errors.length} errors, ` +
    `${result.skipped.length} skipped`
  );

  if (result.errors.length > 0) {
    logger.warn(`Recompute errors: ${result.errors.join("; ")}`);
  }

  // Sync Jira description after worker-based cascade
  try {
    const { prisma } = await import("@/lib/prisma");
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerUserId: true, jiraIssueId: true },
    });
    if (project?.jiraIssueId) {
      const { syncJiraDescription } = await import("@/lib/jira/client");
      await syncJiraDescription(projectId, project.ownerUserId);
    }
  } catch (err) {
    logger.warn(`Jira sync failed (non-blocking): ${err}`);
  }
};

export default task;
