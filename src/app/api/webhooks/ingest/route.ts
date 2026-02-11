/**
 * POST /api/webhooks/ingest — External webhook endpoint for ingesting data
 *
 * Allows external systems (CI/CD pipelines, Zapier, Slack bots, etc.)
 * to push data into a project's evidence store.
 *
 * Authentication: Bearer token (WEBHOOK_SECRET env var)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { ingestDocument } from "@/lib/ai/ingest";
import { createEvidenceSnapshot } from "@/lib/cascade/snapshot";
import { logger } from "@/lib/logger";

const log = logger.child("webhook.ingest");

const webhookPayloadSchema = z.object({
  projectId: z.string().min(1),
  sourceType: z.string().min(1).max(100),
  title: z.string().max(500).optional(),
  content: z.string().min(1).max(200_000),
  externalId: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  // Auth
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.warn("WEBHOOK_SECRET not configured — webhook endpoint disabled");
    return Response.json({ error: "Webhook endpoint not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const expected = `Bearer ${webhookSecret}`;
  // Timing-safe comparison to prevent side-channel attacks
  const authBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  if (authBuf.length !== expectedBuf.length || !timingSafeEqual(authBuf, expectedBuf)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = webhookPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { projectId, sourceType, title, content, externalId, metadata } = parsed.data;

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Ingest
  try {
    const result = await ingestDocument({
      projectId,
      sourceType,
      title: title || `Webhook: ${sourceType}`,
      rawText: content,
      externalId,
      metadata,
    });

    log.info("Webhook ingest complete", {
      projectId,
      sourceType,
      documentId: result.documentId,
      skipped: result.skipped,
      chunkCount: result.chunkCount,
    });

    // Create snapshot if new content was ingested
    let snapshotId: string | null = null;
    if (!result.skipped) {
      try {
        const snapshot = await createEvidenceSnapshot(projectId);
        snapshotId = snapshot.snapshotId;
      } catch (e) {
        log.warn("Snapshot creation failed (non-fatal)", { error: String(e) });
      }
    }

    return Response.json({
      success: true,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      skipped: result.skipped,
      snapshotId,
    });
  } catch (e) {
    log.error("Webhook ingest failed", { error: String(e), projectId });
    return Response.json({ error: "Ingest failed" }, { status: 500 });
  }
}
