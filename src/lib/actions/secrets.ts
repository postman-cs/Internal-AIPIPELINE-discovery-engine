"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

/**
 * Get secret rotation status for a project — returns all tracked secrets
 * and their rotation/expiry state.
 */
export async function getSecretRotationStatus(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" as const, secrets: [] };

  const secrets = await prisma.secretRotation.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return {
    secrets: secrets.map((s) => ({
      id: s.id,
      secretType: s.secretType,
      lastRotatedAt: s.lastRotatedAt.toISOString(),
      expiresAt: s.expiresAt?.toISOString() ?? null,
      status: s.status,
    })),
  };
}

/**
 * Mark a secret as rotated. In a real implementation this would trigger
 * the actual rotation flow (generate new key, update integrations, etc.).
 * For now it resets the rotation timestamp and status.
 */
export async function rotateSecret(projectId: string, secretType: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  const now = new Date();
  const ninetyDaysFromNow = new Date(now);
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  await prisma.secretRotation.upsert({
    where: { projectId_secretType: { projectId, secretType } },
    create: {
      projectId,
      secretType,
      lastRotatedAt: now,
      expiresAt: ninetyDaysFromNow,
      status: "active",
    },
    update: {
      lastRotatedAt: now,
      expiresAt: ninetyDaysFromNow,
      status: "active",
    },
  });

  return { success: true, rotatedAt: now.toISOString() };
}
