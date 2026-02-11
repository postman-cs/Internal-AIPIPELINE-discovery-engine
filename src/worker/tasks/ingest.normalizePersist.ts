/**
 * Task: ingest.normalizePersist
 *
 * Normalizes raw source data and persists to SourceDocument.
 * Idempotent: skips documents with matching contentHash.
 * After persistence, enqueues chunk + embed job.
 */

import type { Task } from "graphile-worker";

interface Payload {
  projectId: string;
  userId: string;
  source: string;
  configJson?: string | null;
}

const task: Task = async (payload, helpers) => {
  const { projectId, source } = payload as Payload;
  const { logger, addJob } = helpers;

  logger.info(`Normalizing source ${source} for project ${projectId}`);

  // This is a stub that would connect to actual source APIs.
  // In production, this would fetch from Gmail, Slack, GitHub, etc.
  // For now, it checks for unconsumed IngestItems and processes them.

  const { prisma } = await import("@/lib/prisma");
  const { ingestDocument } = await import("@/lib/ai/ingest");

  const items = await prisma.ingestItem.findMany({
    where: {
      source,
      consumedAt: null,
      rawText: { not: null },
      ingestRun: { userId: (payload as Payload).userId },
    },
    take: 50,
    orderBy: { timestamp: "desc" },
  });

  let processed = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.rawText) continue;

    const result = await ingestDocument({
      projectId,
      sourceType: source,
      title: item.title,
      rawText: item.rawText,
      externalId: item.externalId || undefined,
    });

    if (result.skipped) {
      skipped++;
    } else {
      processed++;
    }

    // Mark consumed
    await prisma.ingestItem.update({
      where: { id: item.id },
      data: { consumedAt: new Date() },
    });
  }

  logger.info(`Processed: ${processed}, skipped (dedup): ${skipped}`);

  // If any new docs were processed, enqueue snapshot creation
  if (processed > 0) {
    await addJob("snapshot.createEvidenceSnapshot", { projectId }, {
      maxAttempts: 2,
      queueName: `snapshot-${projectId}`,
    });
  }
};

export default task;
