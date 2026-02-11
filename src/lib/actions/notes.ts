"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";

const MAX_NOTE_LENGTH = 10_000;
const MAX_NOTES_PER_PROJECT = 100;

export async function addNote(projectId: string, content: string) {
  const session = await requireAuth();

  // Verify ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  if (!content.trim()) return { error: "Note content is required" };
  if (content.length > MAX_NOTE_LENGTH) return { error: `Note must be under ${MAX_NOTE_LENGTH} characters` };

  // Check limit
  const count = await prisma.projectNote.count({ where: { projectId } });
  if (count >= MAX_NOTES_PER_PROJECT) return { error: "Maximum notes reached" };

  const note = await prisma.projectNote.create({
    data: {
      projectId,
      userId: session.userId,
      content: content.trim(),
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, noteId: note.id };
}

export async function deleteNote(noteId: string) {
  const session = await requireAuth();

  const note = await prisma.projectNote.findFirst({
    where: { id: noteId, userId: session.userId },
    select: { id: true, projectId: true },
  });
  if (!note) return { error: "Note not found" };

  await prisma.projectNote.delete({ where: { id: noteId } });

  revalidatePath(`/projects/${note.projectId}`);
  return { success: true };
}

export async function getNotes(projectId: string) {
  const session = await requireAuth();

  // Verify ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return [];

  return prisma.projectNote.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: MAX_NOTES_PER_PROJECT,
  });
}

export async function toggleProjectPin(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, isPinned: true },
  });
  if (!project) return { error: "Project not found" };

  await prisma.project.update({
    where: { id: projectId },
    data: { isPinned: !project.isPinned },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { success: true, isPinned: !project.isPinned };
}

export async function exportProjectData(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    include: {
      discoveryArtifacts: { orderBy: { version: "desc" }, take: 1 },
      sourceDocuments: { select: { id: true, sourceType: true, title: true, createdAt: true } },
      phaseArtifacts: {
        orderBy: [{ phase: "asc" }, { version: "desc" }],
        select: { phase: true, version: true, status: true, lastComputedAt: true },
      },
    },
  });
  if (!project) return null;

  return {
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      primaryDomain: project.primaryDomain,
      apiDomain: project.apiDomain,
      publicWorkspaceUrl: project.publicWorkspaceUrl,
      createdAt: project.createdAt.toISOString(),
    },
    discovery: project.discoveryArtifacts[0] ? {
      version: project.discoveryArtifacts[0].version,
      aiGenerated: project.discoveryArtifacts[0].aiGenerated,
      markdown: project.discoveryArtifacts[0].generatedBriefMarkdown,
    } : null,
    evidence: {
      documentCount: project.sourceDocuments.length,
      documents: project.sourceDocuments.map((d) => ({
        id: d.id,
        sourceType: d.sourceType,
        title: d.title,
        createdAt: d.createdAt.toISOString(),
      })),
    },
    phases: project.phaseArtifacts.map((a) => ({
      phase: a.phase,
      version: a.version,
      status: a.status,
      lastComputedAt: a.lastComputedAt?.toISOString(),
    })),
  };
}
