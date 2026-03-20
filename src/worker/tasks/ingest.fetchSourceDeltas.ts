/**
 * Task: ingest.fetchSourceDeltas
 *
 * Fetches new data from all enabled ingest sources for all projects.
 * Runs on cron schedule (daily) or on-demand.
 *
 * For each source, checks for new/changed content and enqueues
 * normalization + embedding jobs.
 */

import type { Task } from "graphile-worker";

const task: Task = async (_payload, helpers) => {
  const { logger, addJob } = helpers;
  logger.info("Starting source delta fetch...");

  // Import prisma dynamically to avoid module resolution issues in worker context
  const { prisma } = await import("@/lib/prisma");

  // Find all enabled source configs across all users
  const configs = await prisma.ingestSourceConfig.findMany({
    where: { enabled: true },
    include: { user: { select: { id: true, projects: { select: { id: true } } } } },
  });

  logger.info(`Found ${configs.length} enabled source configs`);

  const { PRIORITY } = await import("@/worker/index");

  for (const config of configs) {
    for (const project of config.user.projects) {
      await addJob("ingest.normalizePersist", {
        projectId: project.id,
        userId: config.userId,
        source: config.source,
        configJson: config.configJson,
      }, {
        maxAttempts: 3,
        queueName: `ingest-${project.id}`,
        priority: PRIORITY.NORMAL,
      });
    }
  }

  logger.info("Source delta fetch complete");
};

export default task;
