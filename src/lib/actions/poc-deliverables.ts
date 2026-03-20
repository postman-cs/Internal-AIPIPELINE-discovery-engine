"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { awardXp } from "@/lib/gamification/xp-engine";
import { DEFAULT_POC_DELIVERABLES } from "@/lib/poc-deliverables-types";
import type { PocDeliverable } from "@/lib/poc-deliverables-types";

export async function getPocDeliverables(
  projectId: string,
): Promise<PocDeliverable[]> {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { pocDeliverablesJson: true },
  });
  if (!project) return [];

  if (!project.pocDeliverablesJson) return [];

  return project.pocDeliverablesJson as unknown as PocDeliverable[];
}

export async function initPocDeliverables(
  projectId: string,
  deliverables?: PocDeliverable[],
) {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { pocDeliverablesJson: true },
  });
  if (!project) return { error: "Project not found" };

  if (project.pocDeliverablesJson) return { success: true };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      pocDeliverablesJson: (deliverables ??
        DEFAULT_POC_DELIVERABLES) as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function togglePocDeliverable(
  projectId: string,
  deliverableId: string,
  completed: boolean,
  evidenceUrl?: string,
  notes?: string,
) {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { pocDeliverablesJson: true },
  });
  if (!project) return { error: "Project not found" };

  const deliverables = (project.pocDeliverablesJson ??
    DEFAULT_POC_DELIVERABLES) as unknown as PocDeliverable[];

  const idx = deliverables.findIndex((d) => d.id === deliverableId);
  if (idx === -1) return { error: "Deliverable not found" };

  const wasCompleted = deliverables[idx].completed;
  deliverables[idx] = {
    ...deliverables[idx],
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    evidenceUrl: evidenceUrl ?? deliverables[idx].evidenceUrl,
    notes: notes ?? deliverables[idx].notes,
  };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      pocDeliverablesJson:
        deliverables as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  if (completed && !wasCompleted) {
    await awardXp(
      session.userId,
      "poc_deliverable_completed",
      75,
      projectId,
      { deliverableId, title: deliverables[idx].title },
    );
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, deliverables };
}

export async function updatePocDeliverableNotes(
  projectId: string,
  deliverableId: string,
  notes: string,
  evidenceUrl?: string,
) {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { pocDeliverablesJson: true },
  });
  if (!project) return { error: "Project not found" };

  const deliverables = (project.pocDeliverablesJson ??
    DEFAULT_POC_DELIVERABLES) as unknown as PocDeliverable[];

  const idx = deliverables.findIndex((d) => d.id === deliverableId);
  if (idx === -1) return { error: "Deliverable not found" };

  deliverables[idx] = {
    ...deliverables[idx],
    notes,
    evidenceUrl: evidenceUrl ?? deliverables[idx].evidenceUrl,
  };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      pocDeliverablesJson:
        deliverables as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
