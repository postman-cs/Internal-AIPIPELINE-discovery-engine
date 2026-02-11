/**
 * Evidence Snapshot
 *
 * An immutable point-in-time capture of all evidence chunks for a project.
 * Created after every ingest operation. Artifacts reference the snapshot
 * they were computed against, enabling reproducibility and change detection.
 */

import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";

export interface SnapshotStats {
  total: number;
  bySource: Record<string, number>;
}

/**
 * Create an EvidenceSnapshot for a project's current set of DocumentChunks.
 *
 * Steps:
 * 1. Query all chunk IDs + source types for the project
 * 2. Compute a deterministic hash from sorted chunk IDs
 * 3. Aggregate counts by source type
 * 4. Store as an immutable snapshot record
 *
 * Returns the snapshot ID and hash.
 */
export async function createEvidenceSnapshot(
  projectId: string
): Promise<{ snapshotId: string; hash: string; stats: SnapshotStats }> {
  // Fetch all chunk IDs and their source types
  const chunks = await prisma.$queryRaw<
    Array<{ id: string; sourceType: string }>
  >`
    SELECT dc."id", sd."sourceType"
    FROM "DocumentChunk" dc
    JOIN "SourceDocument" sd ON sd."id" = dc."documentId"
    WHERE dc."projectId" = ${projectId}
    ORDER BY dc."id" ASC
  `;

  const chunkIds = chunks.map((c) => c.id);

  // Deterministic hash: SHA-256 of sorted chunk IDs
  const hash = crypto
    .createHash("sha256")
    .update(chunkIds.join(","))
    .digest("hex");

  // Aggregate counts by source
  const bySource: Record<string, number> = {};
  for (const c of chunks) {
    bySource[c.sourceType] = (bySource[c.sourceType] || 0) + 1;
  }

  const stats: SnapshotStats = {
    total: chunkIds.length,
    bySource,
  };

  // Check if an identical snapshot already exists (same hash)
  const existing = await prisma.evidenceSnapshot.findFirst({
    where: { projectId, hash },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return { snapshotId: existing.id, hash, stats };
  }

  // Create new snapshot
  const snapshot = await prisma.evidenceSnapshot.create({
    data: {
      projectId,
      chunkIdsJson: chunkIds as Prisma.InputJsonValue,
      countsJson: stats as unknown as Prisma.InputJsonValue,
      hash,
    },
  });

  return { snapshotId: snapshot.id, hash, stats };
}

/**
 * Get the latest EvidenceSnapshot for a project.
 */
export async function getLatestSnapshot(projectId: string) {
  return prisma.evidenceSnapshot.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Compare two snapshot hashes to detect if evidence changed.
 */
export function evidenceChanged(
  currentHash: string,
  previousHash: string | null
): boolean {
  if (!previousHash) return true;
  return currentHash !== previousHash;
}
