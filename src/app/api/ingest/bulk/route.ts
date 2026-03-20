import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const projectId = formData.get("projectId") as string;
  const file = formData.get("file") as File | null;
  const csvText = formData.get("csvText") as string | null;

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const docs: Array<{ sourceType: string; title: string; content: string }> = [];

  if (csvText) {
    const lines = csvText.split("\n").slice(1);
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length >= 3) {
        docs.push({
          sourceType: parts[0].trim().replace(/"/g, ""),
          title: parts[1].trim().replace(/"/g, ""),
          content: parts.slice(2).join(",").trim().replace(/"/g, ""),
        });
      }
    }
  } else if (file) {
    const text = await file.text();
    docs.push({
      sourceType: "UPLOAD",
      title: file.name,
      content: text,
    });
  }

  if (docs.length === 0) {
    return NextResponse.json({ error: "No documents to import" }, { status: 400 });
  }

  let created = 0;
  for (const doc of docs) {
    const contentHash = crypto.createHash("sha256").update(doc.content).digest("hex");
    try {
      await prisma.sourceDocument.upsert({
        where: { projectId_contentHash: { projectId, contentHash } },
        update: { rawText: doc.content, title: doc.title, lastVerifiedAt: new Date() },
        create: {
          projectId,
          sourceType: doc.sourceType,
          title: doc.title,
          rawText: doc.content,
          contentHash,
          freshnessScore: 100,
          lastVerifiedAt: new Date(),
        },
      });
      created++;
    } catch { /* dedup collision */ }
  }

  return NextResponse.json({ success: true, imported: created, total: docs.length });
}
