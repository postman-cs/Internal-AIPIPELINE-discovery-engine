/**
 * Task: monitor.evaluateSignals
 *
 * Runs on schedule to check monitoring signals for all active projects.
 * If drift or anomalies detected, creates a new snapshot and triggers cascade.
 */

import type { Task } from "graphile-worker";

const task: Task = async (_payload, helpers) => {
  const { logger } = helpers;

  logger.info("Evaluating monitoring signals...");

  const { prisma } = await import("@/lib/prisma");

  // Find projects with MONITORING artifacts
  const monitoringArtifacts = await prisma.phaseArtifact.findMany({
    where: { phase: "MONITORING", status: "CLEAN" },
    orderBy: { version: "desc" },
    distinct: ["projectId"],
    select: { projectId: true, contentJson: true },
  });

  for (const artifact of monitoringArtifacts) {
    const content = artifact.contentJson as Record<string, unknown>;
    const monitors = (content?.monitors as Array<Record<string, unknown>>) ?? [];

    if (monitors.length === 0) continue;

    // In a real implementation, this would:
    // 1. Query actual monitoring systems for current signal values
    // 2. Compare against thresholds in the monitoring artifact
    // 3. If drift/anomaly detected, trigger iteration planning
    //
    // For now, log and skip (no external monitoring systems connected)
    logger.info(
      `Project ${artifact.projectId}: ${monitors.length} monitors active (signal evaluation stub)`
    );
  }

  // Enqueue iteration planning for projects with new signals
  // (stub — would be triggered by actual signal evaluation above)
  logger.info("Signal evaluation complete");
};

export default task;
