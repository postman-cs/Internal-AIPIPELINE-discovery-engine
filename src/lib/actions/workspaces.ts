"use server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function createWorkspace(name: string) {
  const session = await requireAuth();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      ownerId: session.userId,
      members: {
        create: { userId: session.userId, role: "owner" },
      },
    },
  });

  revalidatePath("/dashboard");
  return { success: true, workspace };
}

export async function getMyWorkspaces() {
  const session = await requireAuth();
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId: session.userId },
    include: { workspace: true },
    orderBy: { workspace: { name: "asc" } },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
}

export async function inviteToWorkspace(workspaceId: string, email: string, role = "member") {
  const session = await requireAuth();

  const membership = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Not authorized to invite members" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "User not found" };

  await prisma.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    update: { role },
    create: { workspaceId, userId: user.id, role },
  });

  return { success: true };
}

export async function getWorkspaceMembers(workspaceId: string) {
  const session = await requireAuth();

  const membership = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) return { error: "Not a member of this workspace" };

  return prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: { workspace: true },
  });
}
