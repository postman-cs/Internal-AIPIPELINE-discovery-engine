/**
 * Task: ingest.normalizePersist
 *
 * Normalizes raw source data and persists to SourceDocument.
 * Idempotent: skips documents with matching contentHash.
 * After persistence, enqueues chunk + embed job.
 *
 * For GMAIL source with a connected Google account, fetches real threads
 * via the Gmail API instead of processing IngestItems.
 */

import type { Task } from "graphile-worker";

interface Payload {
  projectId: string;
  userId: string;
  source: string;
  configJson?: string | null;
}

const task: Task = async (payload, helpers) => {
  const { projectId, userId, source } = payload as Payload;
  const { logger, addJob } = helpers;

  logger.info(`Normalizing source ${source} for project ${projectId}`);

  const { prisma } = await import("@/lib/prisma");

  // For GMAIL, attempt real fetch if the user has a refresh token
  if (source === "GMAIL") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true },
    });

    if (user?.googleRefreshToken) {
      const { ingestGmailForProject } = await import("@/lib/gmail/ingest");
      const result = await ingestGmailForProject(projectId, userId);
      logger.info(
        `Gmail ingest: ${result.documentsIngested} docs, ${result.attachmentsProcessed} attachments, ${result.skipped} skipped, ${result.errors.length} errors`,
      );
      if (result.documentsIngested > 0 || result.attachmentsProcessed > 0) {
        const { PRIORITY } = await import("@/worker/index");
        await addJob(
          "snapshot.createEvidenceSnapshot",
          { projectId },
          { maxAttempts: 2, queueName: `snapshot-${projectId}`, priority: PRIORITY.NORMAL },
        );
      }
      return;
    }
  }

  // Fallback: process IngestItems (mock or manually uploaded data)
  const { ingestDocument } = await import("@/lib/ai/ingest");

  const items = await prisma.ingestItem.findMany({
    where: {
      source,
      consumedAt: null,
      rawText: { not: null },
      ingestRun: { userId },
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

    await prisma.ingestItem.update({
      where: { id: item.id },
      data: { consumedAt: new Date() },
    });
  }

  logger.info(`Processed: ${processed}, skipped (dedup): ${skipped}`);

  if (processed > 0) {
    const { PRIORITY } = await import("@/worker/index");
    await addJob(
      "snapshot.createEvidenceSnapshot",
      { projectId },
      { maxAttempts: 2, queueName: `snapshot-${projectId}`, priority: PRIORITY.NORMAL },
    );
  }
};

export default task;
