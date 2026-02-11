/**
 * POST /api/ingest/run
 *
 * Enqueues an ingest job. If Graphile Worker is running, delegates to worker.
 * Otherwise falls back to inline execution for dev simplicity.
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ingestDocument } from "@/lib/ai/ingest";
import { createEvidenceSnapshot } from "@/lib/cascade/snapshot";
import { runImpactAnalysis } from "@/lib/cascade/impact";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { projectId, documents } = body as {
      projectId: string;
      documents?: Array<{
        sourceType: string;
        title?: string;
        rawText: string;
        externalId?: string;
        metadata?: Record<string, unknown>;
      }>;
    };

    if (!projectId) {
      return Response.json({ error: "projectId required" }, { status: 400 });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerUserId: session.userId },
    });
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    if (!documents || documents.length === 0) {
      return Response.json({ error: "documents array required" }, { status: 400 });
    }

    // Inline ingest (fallback when worker not running)
    const results = [];
    let newDocs = 0;

    for (const doc of documents) {
      if (!doc.sourceType || !doc.rawText) continue;
      const result = await ingestDocument({
        projectId,
        sourceType: doc.sourceType,
        title: doc.title,
        rawText: doc.rawText,
        externalId: doc.externalId,
        metadata: doc.metadata,
      });
      results.push(result);
      if (!result.skipped) newDocs++;
    }

    // If new documents were ingested, create snapshot + impact analysis
    let snapshotId: string | null = null;
    let impactedPhases: string[] = [];

    if (newDocs > 0) {
      const snapshot = await createEvidenceSnapshot(projectId);
      snapshotId = snapshot.snapshotId;
      const impact = await runImpactAnalysis(projectId, snapshot.snapshotId, "INGEST");
      impactedPhases = impact.impactedPhases;
    }

    return Response.json({
      success: true,
      ingested: results.length,
      newDocuments: newDocs,
      skipped: results.filter((r) => r.skipped).length,
      snapshotId,
      impactedPhases,
      results: results.map((r) => ({
        documentId: r.documentId,
        chunkCount: r.chunkCount,
        skipped: r.skipped,
        skipReason: r.skipReason,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Ingest failed";
    if (msg === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
