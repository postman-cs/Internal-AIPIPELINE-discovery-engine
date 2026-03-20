"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { createProjectSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function syncJiraStatus(
  projectId: string,
  userId: string,
  stage: number,
  prevStage?: number,
  projectName?: string,
  cseName?: string,
) {
  import("@/lib/jira/client")
    .then(({ syncJiraStatusForStage }) => syncJiraStatusForStage(projectId, userId, stage))
    .catch((err) =>
      console.warn("[projects] Jira stage sync failed (non-blocking):", err),
    );

  if (prevStage !== undefined && prevStage !== stage && projectName && cseName) {
    import("@/lib/jira/digest")
      .then(({ sendStageChangeAlert }) =>
        sendStageChangeAlert(projectId, projectName, prevStage, stage, cseName),
      )
      .catch((err) =>
        console.warn("[projects] Stage alert failed (non-blocking):", err),
      );
  }
}

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
    const { getJiraCredentials, createIssue, buildInitialDescription, syncJiraAssignee } =
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

    syncJiraAssignee(projectId, userId).catch(() => {});
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

  logAudit({
    userId: session.userId,
    action: "PROJECT_CREATE",
    targetId: project.id,
    targetType: "Project",
    metadata: { name: parsed.data.name },
  }).catch(() => {});

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
      owner: { select: { name: true, email: true } },
      discoveryArtifacts: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
}

/**
 * Update editable project fields (available to the owning CSE).
 */
export async function updateProject(projectId: string, data: {
  name?: string;
  primaryDomain?: string | null;
  apiDomain?: string | null;
  publicWorkspaceUrl?: string | null;
  customerContactName?: string | null;
  customerContactEmail?: string | null;
  jiraProjectKey?: string | null;
  postmanWorkspaceId?: string | null;
  postmanApiKey?: string | null;
  gitProvider?: string | null;
  gitRepoOwner?: string | null;
  gitRepoName?: string | null;
  gitToken?: string | null;
  gitBaseBranch?: string | null;
}) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
    return { error: "Name is required" };
  }
  if (data.name && data.name.length > 255) {
    return { error: "Name is too long (max 255)" };
  }

  const update: Record<string, unknown> = {};
  const fields = [
    "name", "primaryDomain", "apiDomain", "publicWorkspaceUrl",
    "customerContactName", "customerContactEmail", "jiraProjectKey",
    "postmanWorkspaceId", "postmanApiKey", "gitProvider", "gitRepoOwner", "gitRepoName", "gitToken", "gitBaseBranch",
  ] as const;

  for (const key of fields) {
    if (data[key] !== undefined) {
      update[key] = typeof data[key] === "string" && data[key]!.trim() === "" ? null : data[key];
    }
  }

  if (Object.keys(update).length === 0) return { error: "Nothing to update" };

  await prisma.project.update({ where: { id: projectId }, data: update });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/**
 * CSE-callable engagement stage update based on suggested stage.
 */
export async function updateProjectEngagementStage(projectId: string, stage: number) {
  const session = await requireAuth();
  if (stage < 0 || stage > 6) return { error: "Stage must be 0-6" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, name: true, engagementStage: true },
  });
  if (!project) return { error: "Project not found" };

  const prevStage = project.engagementStage ?? 0;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      engagementStage: stage,
      ...(stage === 6 ? { closedWonAt: new Date(), completedAt: new Date() } : {}),
    },
  });

  syncJiraStatus(projectId, session.userId, stage, prevStage, project.name, session.name ?? "CSE");

  // XP: award points for stage advance
  if (stage > prevStage) {
    import("@/lib/gamification/xp-engine").then(({ awardXp, XP_ACTIONS }) => {
      awardXp(session.userId, XP_ACTIONS.STAGE_ADVANCE.action, XP_ACTIONS.STAGE_ADVANCE.points, projectId, { fromStage: prevStage, toStage: stage }).catch(() => {});
      if (stage === 6) {
        awardXp(session.userId, XP_ACTIONS.POV_DELIVERED.action, XP_ACTIONS.POV_DELIVERED.points, projectId).catch(() => {});
      }
    }).catch(() => {});
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/**
 * CSE-callable project completion. Validates delivery gates, then marks project completed.
 */
export async function requestProjectCompletion(projectId: string): Promise<{
  error?: string;
  success?: boolean;
  failedGates?: string[];
}> {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: {
      id: true,
      serviceTemplateContent: true,
      gitRepoName: true,
      lastRepoPushAt: true,
      engagementStage: true,
    },
  });
  if (!project) return { error: "Project not found" };

  const phases = await prisma.phaseArtifact.findMany({
    where: { projectId },
    orderBy: { version: "desc" },
    distinct: ["phase"],
    select: { phase: true, status: true, version: true },
  });

  const phaseMap = new Map(phases.map((p) => [p.phase as string, p]));

  const isClean = (phase: string) => {
    const a = phaseMap.get(phase);
    return a && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS");
  };

  const gates = [
    { label: "Service template loaded", passed: !!project.serviceTemplateContent },
    { label: "Discovery complete", passed: isClean("DISCOVERY") },
    { label: "Cascade complete", passed: ["CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE", "SOLUTION_DESIGN", "INFRASTRUCTURE", "TEST_DESIGN", "CRAFT_SOLUTION", "TEST_SOLUTION", "DEPLOYMENT_PLAN"].every((p) => isClean(p)) },
    { label: "Repo initialized", passed: !!project.gitRepoName },
    { label: "Artifacts pushed", passed: !!project.lastRepoPushAt },
    { label: "Build log completed", passed: !!phaseMap.get("BUILD_LOG") && (phaseMap.get("BUILD_LOG")?.version ?? 0) >= 1 },
  ];

  const failed = gates.filter((g) => !g.passed).map((g) => g.label);
  if (failed.length > 0) {
    return { error: `${failed.length} delivery gate(s) not met`, failedGates: failed };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "completed",
      completedAt: new Date(),
      engagementStage: 6,
    },
  });

  syncJiraStatus(projectId, session.userId, 6);

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/**
 * Save or update the customer service template on a project.
 */
export async function saveServiceTemplate(projectId: string, data: {
  content: string;
  type: string;
  fileName: string;
  notes: string;
}) {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  if (!data.content.trim()) return { error: "Template content is required" };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      serviceTemplateContent: data.content,
      serviceTemplateType: data.type || "custom",
      serviceTemplateFileName: data.fileName || null,
      serviceTemplateNotes: data.notes || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/discovery`);
  return { success: true };
}

/**
 * Get the service template for a project.
 */
export async function getServiceTemplate(projectId: string) {
  const session = await requireAuth();
  return prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: {
      serviceTemplateContent: true,
      serviceTemplateType: true,
      serviceTemplateFileName: true,
      serviceTemplateNotes: true,
    },
  });
}

/**
 * Remove the service template from a project.
 */
export async function removeServiceTemplate(projectId: string) {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      serviceTemplateContent: null,
      serviceTemplateType: null,
      serviceTemplateFileName: null,
      serviceTemplateNotes: null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/discovery`);
  return { success: true };
}

/**
 * Fetch a service template from a remote URL.
 */
export async function fetchTemplateFromUrl(url: string): Promise<{ content?: string; error?: string }> {
  await requireAuth();

  try {
    new URL(url);
  } catch {
    return { error: "Invalid URL" };
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/plain, application/json, application/yaml, */*" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { error: `Fetch failed: ${res.status} ${res.statusText}` };
    const text = await res.text();
    if (!text.trim()) return { error: "URL returned empty content" };
    if (text.length > 2_000_000) return { error: "Content too large (max 2 MB)" };
    return { content: text };
  } catch (err) {
    return { error: `Fetch error: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
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

/**
 * AI-draft a single build log section from cascade artifacts.
 */
export async function draftBuildLogSection(
  projectId: string,
  sectionKey: string,
): Promise<{ draft?: string; error?: string }> {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, name: true, primaryDomain: true },
  });
  if (!project) return { error: "Project not found" };

  const artifacts = await prisma.phaseArtifact.findMany({
    where: {
      projectId,
      phase: { in: ["DISCOVERY", "CURRENT_TOPOLOGY", "CRAFT_SOLUTION", "TEST_DESIGN", "DEPLOYMENT_PLAN", "INFRASTRUCTURE"] },
    },
    orderBy: { version: "desc" },
    distinct: ["phase"],
    select: { phase: true, contentJson: true },
  });

  const contextSummary = artifacts
    .map((a) => `## ${a.phase}\n${JSON.stringify(a.contentJson).slice(0, 2000)}`)
    .join("\n\n");

  const sectionPrompts: Record<string, string> = {
    useCase:
      "Describe the advanced use case being activated. What workflow is Postman being embedded into? What systems are involved? What does the customer expect to achieve? Return prose, not bullets.",
    successCriteria:
      "List 3-5 measurable success criteria for this use case activation. One per line, no bullets or numbers.",
    internalProof:
      "List what was proven internally before customer implementation — concepts validated, scripts tested, patterns confirmed. One per line, no bullets or numbers.",
    whatWeBuilt:
      "List the concrete artifacts and deliverables built during this engagement. One per line, no bullets or numbers.",
    valueUnlocked:
      "List the key value outcomes and metrics achieved. One per line, no bullets or numbers.",
    reusablePatterns:
      "List reusable patterns, templates, or accelerators that emerged from this engagement. One per line, no bullets or numbers.",
    implementationKit:
      "List the scripts, templates, setup guides, rollout checklists, and architecture docs that form the implementation kit for scaling. One per line, no bullets or numbers.",
    productGapsRisks:
      "List product gaps, risks, or limitations discovered during the engagement. One per line, no bullets or numbers.",
    caseStudySummary:
      "Write a case study summary: what changed, how the use case was implemented, what value it delivered, and why it matters. Return prose, not bullets.",
    nextMotion:
      "Describe who owns the next phase — customer self-service, Professional Services, partner rollout, new CSE engagement, or transition back to Sales. Return prose, not bullets.",
    nextSteps:
      "List recommended next steps including PS handoff, transition plan, or follow-up actions. One per line, no bullets or numbers.",
  };

  const sectionPrompt = sectionPrompts[sectionKey];
  if (!sectionPrompt) return { error: "Unknown section key" };

  try {
    const { selectModel, completeWithFallback } = await import(
      "@/lib/ai/model-router"
    );
    const routing = selectModel("StoryPolisher");
    const response = await completeWithFallback(
      {
        model: routing.model,
        systemPrompt:
          "You are a CSE (Customer Success Engineer) writing a POV (Proof of Value) build log for a customer engagement. Write concisely and specifically based on the project data provided. Use technical details from the cascade artifacts. Return plain text lines only — no markdown formatting, no bullet characters, no numbering.",
        userPrompt: `Project: ${project.name} (${project.primaryDomain ?? ""})\n\n${contextSummary}\n\n${sectionPrompt}`,
        temperature: 0.3,
      },
      routing.fallback,
    );

    return { draft: response.content.trim() };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "AI drafting failed",
    };
  }
}

/**
 * Dry-run completion gate check without marking the project complete.
 */
export async function getCompletionGateStatus(projectId: string): Promise<{
  gates: Array<{ label: string; passed: boolean; href: string | null }>;
  allPassed: boolean;
}> {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: {
      id: true,
      serviceTemplateContent: true,
      gitRepoName: true,
      lastRepoPushAt: true,
    },
  });
  if (!project) return { gates: [], allPassed: false };

  const phases = await prisma.phaseArtifact.findMany({
    where: { projectId },
    orderBy: { version: "desc" },
    distinct: ["phase"],
    select: { phase: true, status: true, version: true },
  });

  const phaseMap = new Map(phases.map((p) => [p.phase as string, p]));

  const isClean = (phase: string) => {
    const a = phaseMap.get(phase);
    return a && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS");
  };

  const cascadePhases = [
    "CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE", "SOLUTION_DESIGN",
    "INFRASTRUCTURE", "TEST_DESIGN", "CRAFT_SOLUTION", "TEST_SOLUTION", "DEPLOYMENT_PLAN",
  ];

  const gates = [
    { label: "Service template loaded", passed: !!project.serviceTemplateContent, href: `/projects/${projectId}/discovery` },
    { label: "Discovery complete", passed: !!isClean("DISCOVERY"), href: `/projects/${projectId}/discovery` },
    { label: "Cascade complete (9 phases)", passed: cascadePhases.every((p) => isClean(p)), href: `/projects/${projectId}/updates` },
    { label: "Repo initialized", passed: !!project.gitRepoName, href: `/projects/${projectId}/repo` },
    { label: "Artifacts pushed to repo", passed: !!project.lastRepoPushAt, href: `/projects/${projectId}/repo` },
    { label: "Build log saved", passed: !!phaseMap.get("BUILD_LOG") && (phaseMap.get("BUILD_LOG")?.version ?? 0) >= 1, href: `/projects/${projectId}/buildlog` },
  ];

  return { gates, allPassed: gates.every((g) => g.passed) };
}

export async function cloneProjectForNewEngagement(sourceProjectId: string) {
  const session = await requireAuth();

  const source = await prisma.project.findFirst({
    where: { id: sourceProjectId, ownerUserId: session.userId },
    select: {
      name: true,
      primaryDomain: true,
      apiDomain: true,
      publicWorkspaceUrl: true,
      customerContactName: true,
      customerContactEmail: true,
      serviceTemplateContent: true,
      serviceTemplateType: true,
      serviceTemplateFileName: true,
      serviceTemplateNotes: true,
      gitProvider: true,
      gitRepoOwner: true,
      gitRepoName: true,
      gitBaseBranch: true,
      jiraProjectKey: true,
      slackWebhookUrl: true,
    },
  });

  if (!source) return { error: "Project not found" };

  const newProject = await prisma.project.create({
    data: {
      name: `${source.name} (Phase 2)`,
      primaryDomain: source.primaryDomain,
      apiDomain: source.apiDomain,
      publicWorkspaceUrl: source.publicWorkspaceUrl,
      customerContactName: source.customerContactName,
      customerContactEmail: source.customerContactEmail,
      serviceTemplateContent: source.serviceTemplateContent,
      serviceTemplateType: source.serviceTemplateType,
      serviceTemplateFileName: source.serviceTemplateFileName,
      serviceTemplateNotes: source.serviceTemplateNotes,
      gitProvider: source.gitProvider,
      gitRepoOwner: source.gitRepoOwner,
      gitBaseBranch: source.gitBaseBranch,
      jiraProjectKey: source.jiraProjectKey,
      slackWebhookUrl: source.slackWebhookUrl,
      ownerUserId: session.userId,
      engagementStage: 0,
      clonedFromId: sourceProjectId,
    },
  });

  logAudit({
    userId: session.userId,
    action: "PROJECT_CREATE",
    targetId: newProject.id,
    targetType: "Project",
    metadata: { name: newProject.name, clonedFrom: sourceProjectId },
  }).catch(() => {});

  await setupJiraForProject(
    session.userId,
    newProject.id,
    newProject.name,
    source.primaryDomain,
    source.jiraProjectKey,
  );

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${newProject.id}`);
}
