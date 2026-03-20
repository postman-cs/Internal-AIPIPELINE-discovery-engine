import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const event = body.webhookEvent;
  const issue = body.issue;

  if (!issue?.key) {
    return NextResponse.json({ ok: true });
  }

  // Find the project linked to this Jira issue
  const project = await prisma.project.findFirst({
    where: { jiraIssueKey: issue.key },
    select: { id: true, ownerUserId: true },
  });

  // Blocker auto-resolution
  const blocker = await prisma.blocker.findFirst({
    where: {
      project: { jiraIssueKey: issue.key },
    },
    include: { project: true },
  });

  if (blocker && event === "jira:issue_updated") {
    const status = issue.fields?.status?.name?.toLowerCase();
    if (status === "done" || status === "closed" || status === "resolved") {
      await prisma.blocker.update({
        where: { id: blocker.id },
        data: {
          status: "NEUTRALIZED",
          resolvedAt: new Date(),
          resolutionNotes: `Auto-resolved via Jira issue ${issue.key} status: ${issue.fields?.status?.name}`,
        },
      });
    }
  }

  // Point 15: Bidirectional comment sync — Jira comments → Admiral Notes
  if (event === "comment_created" && body.comment?.body && project) {
    const authorName = body.comment.author?.displayName || "Jira User";
    const authorEmail = body.comment.author?.emailAddress || "";

    // Extract plain text from ADF comment body
    let commentText = "";
    if (typeof body.comment.body === "string") {
      commentText = body.comment.body;
    } else if (body.comment.body?.content) {
      commentText = body.comment.body.content
        .flatMap((block: { content?: Array<{ text?: string }> }) =>
          block.content?.map((inline: { text?: string }) => inline.text ?? "") ?? [],
        )
        .join(" ")
        .trim();
    }

    // Skip comments posted by CortexLab to avoid loops
    if (commentText && !commentText.startsWith("[CortexLab]") && project.ownerUserId) {
      await prisma.admiralNote.create({
        data: {
          authorId: project.ownerUserId,
          projectId: project.id,
          scope: "project",
          content: `[Jira ${issue.key} — ${authorName}] ${commentText}`,
          pinned: false,
        },
      });
    }

    // Also append to blocker notes if there's a linked blocker
    if (blocker && commentText) {
      const currentNotes = blocker.notes || "";
      await prisma.blocker.update({
        where: { id: blocker.id },
        data: {
          notes: `${currentNotes}\n\n[Jira ${issue.key}] ${authorName}: ${commentText}`.trim(),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
