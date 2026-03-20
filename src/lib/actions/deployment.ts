"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { awardXp } from "@/lib/gamification/xp-engine";
import { XP_ACTIONS } from "@/lib/gamification/xp-constants";

export async function executeDeploymentStep(
  projectId: string,
  stepIndex: number,
  stepTitle: string,
) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) return { success: false, error: "Project not found" };

  const artifact = await prisma.phaseArtifact.findFirst({
    where: { projectId, phase: "DEPLOYMENT_PLAN" },
    orderBy: { version: "desc" },
  });
  if (!artifact) return { success: false, error: "No deployment plan" };

  const content = artifact.contentJson as Record<string, unknown>;
  const executedSteps = (content.executedSteps as number[] | undefined) ?? [];

  if (executedSteps.includes(stepIndex)) {
    return { success: false, error: "Step already executed" };
  }

  const updatedExecuted = [...executedSteps, stepIndex];

  await prisma.phaseArtifact.update({
    where: { id: artifact.id },
    data: {
      contentJson: {
        ...content,
        executedSteps: updatedExecuted,
      },
    },
  });

  const xpResult = await awardXp(
    session.userId,
    XP_ACTIONS.DEPLOYMENT_STEP_EXECUTED.action,
    XP_ACTIONS.DEPLOYMENT_STEP_EXECUTED.points,
    projectId,
    { stepIndex, stepTitle },
  );

  revalidatePath(`/projects/${projectId}`);

  return {
    success: true,
    stepIndex,
    xp: {
      points: xpResult.points,
      newXp: xpResult.newXp,
      leveledUp: xpResult.leveledUp,
    },
    totalExecuted: updatedExecuted.length,
  };
}
