"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

export async function generateArchitectShareLink(
  projectId: string,
  prefillData?: Record<string, unknown>,
) {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, architectShareToken: true },
  });
  if (!project) return { error: "Project not found" };

  let token = project.architectShareToken;
  if (!token) {
    token = randomUUID();
    await prisma.project.update({
      where: { id: projectId },
      data: {
        architectShareToken: token,
        architectShareData: prefillData ? (prefillData as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
  } else if (prefillData) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        architectShareData: prefillData as Prisma.InputJsonValue,
      },
    });
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, token };
}

export async function revokeArchitectShareLink(projectId: string) {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  await prisma.project.update({
    where: { id: projectId },
    data: { architectShareToken: null, architectShareData: Prisma.DbNull },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function getProjectByShareToken(token: string) {
  const project = await prisma.project.findFirst({
    where: { architectShareToken: token },
    select: {
      id: true,
      name: true,
      primaryDomain: true,
      architectShareData: true,
      customerContactName: true,
    },
  });
  if (!project) return null;
  return project;
}

export async function submitPublicArchitectForm(
  token: string,
  data: Record<string, unknown>,
) {
  const project = await prisma.project.findFirst({
    where: { architectShareToken: token },
    select: { id: true, ownerUserId: true },
  });
  if (!project) return { error: "Invalid or expired link" };

  await prisma.project.update({
    where: { id: project.id },
    data: {
      architectShareData: data as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/projects/${project.id}`);
  return { success: true, projectId: project.id };
}
