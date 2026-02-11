/**
 * POST /api/ingest/run
 *
 * Enqueues an ingest job. If Graphile Worker is running, delegates to worker.
 * Otherwise falls back to inline execution for dev simplicity.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ingestDocument } from "@/lib/ai/ingest";
import { createEvidenceSnapshot } from "@/lib/cascade/snapshot";
import { runImpactAnalysis } from "@/lib/cascade/impact";

// ---------------------------------------------------------------------------
// Input validation schema
// ---------------------------------------------------------------------------

const MAX_DOCUMENTS_PER_REQUEST = 50;
const MAX_RAW_TEXT_LENGTH = 100_000; // ~100KB per document
const MAX_TITLE_LENGTH = 500;
const MAX_SOURCE_TYPE_LENGTH = 100;

const ingestDocumentSchema = z.object({
  sourceType: z.string().min(1).max(MAX_SOURCE_TYPE_LENGTH),
  title: z.string().max(MAX_TITLE_LENGTH).optional(),
  rawText: z.string().min(1).max(MAX_RAW_TEXT_LENGTH),
  externalId: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ingestRequestSchema = z.object({
  projectId: z.string().min(1, "projectId required"),
  documents: z
    .array(ingestDocumentSchema)
    .min(1, "documents array required")
    .max(MAX_DOCUMENTS_PER_REQUEST, `Maximum ${MAX_DOCUMENTS_PER_REQUEST} documents per request`),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = ingestRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { projectId, documents } = parsed.data;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerUserId: session.userId },
    });
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Inline ingest (fallback when worker not running)
    const results = [];
    let newDocs = 0;

    for (const doc of documents) {
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
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/ingest/run] Unhandled error:", error);
    return Response.json({ error: "Ingest failed" }, { status: 500 });
  }
}
