import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const webhookSecret = request.headers.get("x-webhook-secret");
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing X-Webhook-Secret header" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, sourceType, title, content, metadata } = body;

  if (!projectId || !sourceType || !content) {
    return NextResponse.json({ error: "projectId, sourceType, and content are required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, webhookSecret },
  });
  if (!project) {
    return NextResponse.json({ error: "Invalid project or webhook secret" }, { status: 403 });
  }

  const contentHash = crypto.createHash("sha256").update(content).digest("hex");

  const doc = await prisma.sourceDocument.upsert({
    where: { projectId_contentHash: { projectId, contentHash } },
    update: { rawText: content, title, metadataJson: metadata, lastVerifiedAt: new Date() },
    create: {
      projectId,
      sourceType,
      title: title || `Webhook: ${sourceType}`,
      rawText: content,
      contentHash,
      metadataJson: metadata,
      freshnessScore: 100,
      lastVerifiedAt: new Date(),
    },
  });

  void (async () => {
    try {
      const { createEvidenceSnapshot } = await import("@/lib/cascade/snapshot");
      const snapshot = await createEvidenceSnapshot(projectId);
      const { runImpactAnalysis } = await import("@/lib/cascade/impact");
      await runImpactAnalysis(projectId, snapshot.snapshotId, "WEBHOOK");
    } catch (err) {
      console.error("[webhook] Auto-cascade failed:", err);
    }
  })();

  return NextResponse.json({ success: true, documentId: doc.id });
}
