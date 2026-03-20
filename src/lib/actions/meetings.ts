"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { ingestDocument } from "@/lib/ai/ingest";
import { createEvidenceSnapshot } from "@/lib/cascade/snapshot";
import { runImpactAnalysis } from "@/lib/cascade/impact";
import { awardXp } from "@/lib/gamification/xp-engine";
import { XP_ACTIONS } from "@/lib/gamification/xp-constants";
import type { Phase } from "@prisma/client";

type SessionType = "meeting" | "working_session";

interface TranscriptInput {
  type: SessionType;
  title: string;
  transcript: string;
  date?: string;
  attendees?: string;
  notes?: string;
}

export async function ingestTranscript(projectId: string, input: TranscriptInput) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) return { success: false, error: "Project not found" };
  if (!input.transcript.trim()) return { success: false, error: "Transcript is empty" };

  const phase: Phase = input.type === "meeting" ? "MEETINGS" : "WORKING_SESSIONS";
  const sourceType = input.type === "meeting" ? "MEETING_TRANSCRIPT" : "WORKING_SESSION_TRANSCRIPT";
  const xpAction = input.type === "meeting"
    ? XP_ACTIONS.MEETING_COMPLETED
    : XP_ACTIONS.WORKING_SESSION_COMPLETED;

  const header = [
    `# ${input.type === "meeting" ? "Meeting" : "Working Session"}: ${input.title}`,
    input.date ? `Date: ${input.date}` : "",
    input.attendees ? `Attendees: ${input.attendees}` : "",
    input.notes ? `Notes: ${input.notes}` : "",
    "---",
    "",
  ].filter(Boolean).join("\n");

  const fullText = header + input.transcript;

  const result = await ingestDocument({
    projectId,
    sourceType,
    title: input.title,
    rawText: fullText,
  });

  const snapshot = await createEvidenceSnapshot(projectId);

  const impact = await runImpactAnalysis(projectId, snapshot.snapshotId, "INGEST");

  const existing = await prisma.phaseArtifact.findFirst({
    where: { projectId, phase },
    orderBy: { version: "desc" },
  });

  const currentEntries = existing
    ? ((existing.contentJson as Record<string, unknown>)?.entries as unknown[] ?? [])
    : [];

  const newEntry = {
    id: result.documentId,
    title: input.title,
    type: input.type,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    attendees: input.attendees ?? "",
    chunkCount: result.chunkCount,
    ingestedAt: new Date().toISOString(),
  };

  const updatedEntries = [...currentEntries, newEntry];
  const newVersion = (existing?.version ?? 0) + 1;

  await prisma.phaseArtifact.create({
    data: {
      projectId,
      phase,
      version: newVersion,
      status: "CLEAN",
      snapshotId: snapshot.snapshotId,
      contentJson: {
        entries: updatedEntries,
        totalSessions: updatedEntries.length,
        lastSessionAt: newEntry.date,
      },
      contentMarkdown: generateMarkdown(phase, updatedEntries as TranscriptEntry[]),
      lastComputedAt: new Date(),
    },
  });

  const xpResult = await awardXp(
    session.userId,
    xpAction.action,
    xpAction.points,
    projectId,
    { title: input.title, type: input.type },
  );

  revalidatePath(`/projects/${projectId}`);

  return {
    success: true,
    documentId: result.documentId,
    chunkCount: result.chunkCount,
    snapshotId: snapshot.snapshotId,
    impactedPhases: impact.impactedPhases,
    xp: { points: xpResult.points, newXp: xpResult.newXp, leveledUp: xpResult.leveledUp },
    entryCount: updatedEntries.length,
  };
}

export async function getMissionData(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, name: true },
  });
  if (!project) return null;

  const [meetingsArtifact, sessionsArtifact, user] = await Promise.all([
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "MEETINGS" },
      orderBy: { version: "desc" },
    }),
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "WORKING_SESSIONS" },
      orderBy: { version: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { xp: true, xpLevel: true, name: true },
    }),
  ]);

  const meetingEntries = meetingsArtifact
    ? ((meetingsArtifact.contentJson as Record<string, unknown>)?.entries as TranscriptEntry[] ?? [])
    : [];

  const sessionEntries = sessionsArtifact
    ? ((sessionsArtifact.contentJson as Record<string, unknown>)?.entries as TranscriptEntry[] ?? [])
    : [];

  return {
    projectName: project.name,
    meetings: {
      entries: meetingEntries,
      status: meetingsArtifact?.status ?? "STALE",
      version: meetingsArtifact?.version ?? 0,
    },
    sessions: {
      entries: sessionEntries,
      status: sessionsArtifact?.status ?? "STALE",
      version: sessionsArtifact?.version ?? 0,
    },
    user: user ? { name: user.name, xp: user.xp, level: user.xpLevel } : null,
  };
}

interface TranscriptEntry {
  id: string;
  title: string;
  type: string;
  date: string;
  attendees: string;
  chunkCount: number;
  ingestedAt: string;
}

function generateMarkdown(phase: Phase, entries: TranscriptEntry[]): string {
  const label = phase === "MEETINGS" ? "Meetings" : "Working Sessions";
  const rows = entries
    .map((e) => `| ${e.date} | ${e.title} | ${e.attendees || "—"} | ${e.chunkCount} chunks |`)
    .join("\n");

  return `# ${label}\n\n| Date | Title | Attendees | Evidence |\n|------|-------|-----------|----------|\n${rows}\n\n**Total**: ${entries.length} ${label.toLowerCase()}`;
}
