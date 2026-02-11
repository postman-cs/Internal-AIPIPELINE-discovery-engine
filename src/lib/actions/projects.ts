"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { createProjectSchema } from "@/lib/schemas";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createProjectAction(_prev: unknown, formData: FormData) {
  const session = await requireAuth();

  const raw = {
    name: formData.get("name") as string,
    primaryDomain: formData.get("primaryDomain") as string,
    apiDomain: formData.get("apiDomain") as string,
    publicWorkspaceUrl: formData.get("publicWorkspaceUrl") as string,
  };

  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      primaryDomain: parsed.data.primaryDomain || null,
      apiDomain: parsed.data.apiDomain || null,
      publicWorkspaceUrl: parsed.data.publicWorkspaceUrl || null,
      ownerUserId: session.userId,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}

export async function getProjects() {
  const session = await requireAuth();
  return prisma.project.findMany({
    where: { ownerUserId: session.userId },
    orderBy: { updatedAt: "desc" },
    include: {
      discoveryArtifacts: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
}

export async function getProject(projectId: string) {
  const session = await requireAuth();
  return prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    include: {
      discoveryArtifacts: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
}
