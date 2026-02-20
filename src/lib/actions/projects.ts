"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { createProjectSchema } from "@/lib/schemas";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function setupGmailForProject(
  userId: string,
  projectId: string,
  projectName: string,
  domain: string,
) {
  try {
    const { getGmailClient, getOrCreateLabel, createDomainFilter } =
      await import("@/lib/gmail/client");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true },
    });
    if (!user?.googleRefreshToken) return;

    const gmail = await getGmailClient(userId);

    const safeName = projectName.replace(/[/\\]/g, "-").slice(0, 50);
    const labelName = `CortexLab/${safeName}`;
    const labelId = await getOrCreateLabel(gmail, labelName);

    const filterId = await createDomainFilter(gmail, domain, labelId);

    await prisma.project.update({
      where: { id: projectId },
      data: { gmailLabelId: labelId, gmailFilterId: filterId },
    });
  } catch (err) {
    console.warn("[project-create] Gmail setup failed (non-blocking):", err);
  }
}

async function setupJiraForProject(
  userId: string,
  projectId: string,
  projectName: string,
  domain: string | null,
  jiraProjectKeyOverride: string | null,
) {
  try {
    const { getJiraCredentials, createIssue, buildInitialDescription } =
      await import("@/lib/jira/client");

    const creds = await getJiraCredentials(userId);
    if (!creds) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { jiraDefaultProject: true, jiraIssueType: true },
    });

    const projectKey = jiraProjectKeyOverride || user?.jiraDefaultProject;
    if (!projectKey) return;

    const issueType = user?.jiraIssueType || "Task";

    const summary = domain
      ? `[CortexLab] ${projectName} — ${domain}`
      : `[CortexLab] ${projectName}`;

    const projectUrl = `http://localhost:3000/projects/${projectId}`;
    const description = buildInitialDescription(projectName, domain, projectUrl);

    const { issueKey, issueId } = await createIssue(
      creds,
      projectKey,
      summary,
      description,
      issueType,
    );

    await prisma.project.update({
      where: { id: projectId },
      data: {
        jiraIssueKey: issueKey,
        jiraIssueId: issueId,
        jiraProjectKey: projectKey,
      },
    });
  } catch (err) {
    console.warn("[project-create] Jira setup failed (non-blocking):", err);
  }
}

export async function createProjectAction(_prev: unknown, formData: FormData) {
  const session = await requireAuth();

  const raw = {
    name: formData.get("name") as string,
    primaryDomain: formData.get("primaryDomain") as string,
    apiDomain: formData.get("apiDomain") as string,
    publicWorkspaceUrl: formData.get("publicWorkspaceUrl") as string,
    customerDomain: formData.get("customerDomain") as string,
  };

  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const customerDomain = raw.customerDomain?.trim() || null;

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      primaryDomain: parsed.data.primaryDomain || null,
      apiDomain: parsed.data.apiDomain || null,
      publicWorkspaceUrl: parsed.data.publicWorkspaceUrl || null,
      ownerUserId: session.userId,
    },
  });

  if (customerDomain) {
    await setupGmailForProject(
      session.userId,
      project.id,
      parsed.data.name,
      customerDomain,
    );
  }

  const jiraProjectKey =
    (formData.get("jiraProjectKey") as string)?.trim() || null;
  await setupJiraForProject(
    session.userId,
    project.id,
    parsed.data.name,
    parsed.data.primaryDomain || null,
    jiraProjectKey,
  );

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}

export async function getProjects() {
  const session = await requireAuth();
  return prisma.project.findMany({
    where: { ownerUserId: session.userId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    include: {
      discoveryArtifacts: {
        orderBy: { version: "desc" },
        take: 1,
      },
      _count: { select: { sourceDocuments: true, phaseArtifacts: true } },
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

/**
 * Search projects by name (for command palette / search).
 */
export async function searchProjects(query: string) {
  const session = await requireAuth();
  return prisma.project.findMany({
    where: {
      ownerUserId: session.userId,
      name: { contains: query, mode: "insensitive" },
    },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    take: 10,
    select: { id: true, name: true, primaryDomain: true, isPinned: true },
  });
}
