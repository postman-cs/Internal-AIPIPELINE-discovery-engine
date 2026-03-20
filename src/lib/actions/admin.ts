"use server";

/**
 * Admin CRUD Server Actions
 *
 * Full create/read/update/delete for all system entities.
 * All actions require admin authentication.
 */

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { BlockerSeverity, BlockerStatus, AssumptionStatus } from "@prisma/client";
import { syncJiraStatusForStage } from "@/lib/jira/client";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const BLOCKER_STATUSES: BlockerStatus[] = ["IDENTIFIED", "MAPPED", "MISSILE_DESIGNED", "MISSILE_FIRED", "NUKE_ARMED", "NUKE_LAUNCHED", "NEUTRALIZED", "ACCEPTED", "DORMANT"];
const BLOCKER_SEVERITIES: BlockerSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const ASSUMPTION_STATUSES: AssumptionStatus[] = ["PENDING", "VERIFIED", "CORRECTED", "REJECTED", "AUTO_VERIFIED"];

const emailSchema = z.string().email("Invalid email address").max(255);
const nameSchema = z.string().min(1, "Name is required").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || (!session.isAdmin && session.role !== "ADMIRAL" && session.role !== "ADMIN")) {
    throw new Error("Admiral access required");
  }
  return session;
}

function revalidateAdmin() {
  revalidatePath("/admiral", "layout");
}

function setupJiraForAdminProject(
  ownerUserId: string,
  projectId: string,
  projectName: string,
  domain: string | null,
) {
  import("@/lib/jira/client")
    .then(async ({ getJiraCredentials, createIssue, buildInitialDescription, syncJiraAssignee }) => {
      const creds = await getJiraCredentials(ownerUserId);
      if (!creds) return;

      const user = await prisma.user.findUnique({
        where: { id: ownerUserId },
        select: { jiraDefaultProject: true, jiraIssueType: true },
      });
      const projectKey = user?.jiraDefaultProject;
      if (!projectKey) return;

      const issueType = user?.jiraIssueType || "Task";
      const summary = domain
        ? `[CortexLab] ${projectName} — ${domain}`
        : `[CortexLab] ${projectName}`;

      const projectUrl = `http://localhost:3000/projects/${projectId}`;
      const description = buildInitialDescription(projectName, domain, projectUrl);

      const { issueKey, issueId } = await createIssue(
        creds, projectKey, summary, description, issueType,
      );

      await prisma.project.update({
        where: { id: projectId },
        data: { jiraIssueKey: issueKey, jiraIssueId: issueId, jiraProjectKey: projectKey },
      });

      syncJiraAssignee(projectId, ownerUserId).catch(() => {});
    })
    .catch((err) =>
      console.warn("[admin] Jira setup failed (non-blocking):", err),
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════

export async function getUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true, isAdmin: true, role: true,
      createdAt: true, updatedAt: true,
      _count: { select: { projects: true, ingestRuns: true } },
    },
  });
}

export async function getUser(id: string) {
  await requireAdmin();
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, isAdmin: true,
      createdAt: true, updatedAt: true,
      projects: { select: { id: true, name: true, primaryDomain: true, updatedAt: true } },
      _count: { select: { projects: true, ingestRuns: true, ingestSourceConfigs: true } },
    },
  });
}

export async function createUser(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;
  const roleStr = (formData.get("role") as string) || "CSE";
  const role = roleStr === "ADMIN" ? "ADMIN" as const : roleStr === "ADMIRAL" ? "ADMIRAL" as const : "CSE" as const;
  const isAdmin = role === "ADMIN" || role === "ADMIRAL";

  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) return { error: emailResult.error.errors[0].message };
  const nameResult = nameSchema.safeParse(name);
  if (!nameResult.success) return { error: nameResult.error.errors[0].message };
  const pwResult = passwordSchema.safeParse(password);
  if (!pwResult.success) return { error: pwResult.error.errors[0].message };

  const existing = await prisma.user.findUnique({ where: { email: emailResult.data } });
  if (existing) return { error: "A user with this email already exists" };

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await prisma.user.create({
      data: { email: emailResult.data, name: nameResult.data, passwordHash, isAdmin, role },
    });
  } catch (e) {
    console.error("[admin] createUser failed:", e);
    return { error: "Failed to create user." };
  }

  revalidateAdmin();
  return { success: true };
}

export async function updateUser(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;
  const isAdmin = formData.get("isAdmin") === "on";

  if (!id) return { error: "User ID is required" };
  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) return { error: emailResult.error.errors[0].message };
  const nameResult = nameSchema.safeParse(name);
  if (!nameResult.success) return { error: nameResult.error.errors[0].message };

  const data: Record<string, unknown> = { email: emailResult.data, name: nameResult.data, isAdmin };
  if (password && password.length > 0) {
    const pwResult = passwordSchema.safeParse(password);
    if (!pwResult.success) return { error: pwResult.error.errors[0].message };
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  try {
    await prisma.user.update({ where: { id }, data });
  } catch (e) {
    console.error("[admin] updateUser failed:", e);
    return { error: "Failed to update user." };
  }
  revalidateAdmin();
  return { success: true };
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if (session.userId === id) return { error: "Cannot delete yourself" };

  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    console.error("[admin] deleteUser failed:", e);
    return { error: "Failed to delete user. They may have associated data that must be removed first." };
  }
  revalidateAdmin();
  return { success: true };
}

export async function deleteCseAndReassign(cseId: string, reassignToId?: string) {
  const session = await requireAdmin();
  if (session.userId === cseId) return { error: "Cannot delete yourself" };
  if (!cseId) return { error: "Missing CSE ID" };

  const cse = await prisma.user.findUnique({ where: { id: cseId }, include: { _count: { select: { projects: true } } } });
  if (!cse) return { error: "CSE not found" };

  let moved = 0;
  if (cse._count.projects > 0) {
    if (!reassignToId) return { error: "Must choose a CSE to reassign projects to" };
    if (cseId === reassignToId) return { error: "Cannot reassign projects to the same CSE being deleted" };
    const target = await prisma.user.findUnique({ where: { id: reassignToId } });
    if (!target) return { error: "Reassignment target not found" };

    const result = await prisma.project.updateMany({
      where: { ownerUserId: cseId },
      data: { ownerUserId: reassignToId },
    });
    moved = result.count;

    await prisma.admiralNote.updateMany({
      where: { cseUserId: cseId },
      data: { cseUserId: reassignToId },
    });

    await prisma.admiralTask.updateMany({
      where: { assigneeId: cseId },
      data: { assigneeId: reassignToId },
    });
  }

  await prisma.user.delete({ where: { id: cseId } });

  revalidateAdmin();
  return { success: true, moved };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdminProjects() {
  await requireAdmin();
  return prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { name: true, email: true } },
      _count: {
        select: {
          sourceDocuments: true, phaseArtifacts: true,
          discoveryArtifacts: true, assumptions: true, blockers: true,
        },
      },
    },
  });
}

export async function getAdminProject(id: string) {
  await requireAdmin();
  return prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true, id: true } },
      _count: {
        select: {
          sourceDocuments: true, phaseArtifacts: true,
          discoveryArtifacts: true, assumptions: true, blockers: true,
        },
      },
    },
  });
}

export async function createProject(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const primaryDomain = formData.get("primaryDomain") as string;
  const ownerUserId = (formData.get("ownerUserId") as string) || null;

  if (!name) return { error: "Name is required" };
  if (name.length > 255) return { error: "Name is too long (max 255 characters)" };

  let project;
  try {
    project = await prisma.project.create({
      data: { name, primaryDomain: primaryDomain || null, ownerUserId },
    });
  } catch (e) {
    console.error("[admin] createProject failed:", e);
    return { error: "Failed to create project." };
  }

  if (ownerUserId) {
    setupJiraForAdminProject(ownerUserId, project.id, name, primaryDomain || null);
  }

  revalidateAdmin();
  return { success: true };
}

export async function updateProject(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const primaryDomain = formData.get("primaryDomain") as string;
  const ownerUserId = formData.get("ownerUserId") as string;

  if (!id || !name) return { error: "Name is required" };
  if (name.length > 255) return { error: "Name is too long (max 255 characters)" };

  try {
    await prisma.project.update({
      where: { id },
      data: {
        name,
        primaryDomain: primaryDomain || null,
        ...(ownerUserId ? { ownerUserId } : {}),
      },
    });
  } catch (e) {
    console.error("[admin] updateProject failed:", e);
    return { error: "Failed to update project." };
  }

  revalidateAdmin();
  return { success: true };
}

export async function deleteProject(id: string) {
  const session = await requireAdmin();
  try {
    await prisma.project.delete({ where: { id } });
  } catch (e) {
    console.error("[admin] deleteProject failed:", e);
    return { error: "Failed to delete project. It may have dependent records." };
  }

  logAudit({
    userId: session.userId!,
    action: "PROJECT_DELETE",
    targetId: id,
    targetType: "Project",
  }).catch(() => {});

  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCKERS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdminBlockers(projectId?: string) {
  await requireAdmin();
  return prisma.blocker.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { name: true } },
      _count: { select: { missiles: true, nukes: true } },
    },
  });
}

export async function updateBlockerStatus(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  const severity = formData.get("severity") as string;

  if (!id) return { error: "Blocker ID is required" };
  if (status && !BLOCKER_STATUSES.includes(status as BlockerStatus)) {
    return { error: `Invalid blocker status: ${status}` };
  }
  if (severity && !BLOCKER_SEVERITIES.includes(severity as BlockerSeverity)) {
    return { error: `Invalid blocker severity: ${severity}` };
  }

  try {
    await prisma.blocker.update({
      where: { id },
      data: {
        ...(status ? { status: status as BlockerStatus } : {}),
        ...(severity ? { severity: severity as BlockerSeverity } : {}),
      },
    });
  } catch (e) {
    console.error("[admin] updateBlockerStatus failed:", e);
    return { error: "Failed to update blocker." };
  }

  revalidateAdmin();
  return { success: true };
}

export async function deleteBlocker(id: string) {
  await requireAdmin();
  try {
    await prisma.blocker.delete({ where: { id } });
  } catch (e) {
    console.error("[admin] deleteBlocker failed:", e);
    return { error: "Failed to delete blocker. It may have associated missiles or nukes." };
  }
  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSUMPTIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdminAssumptions(projectId?: string) {
  await requireAdmin();
  return prisma.assumption.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { name: true } },
    },
  });
}

export async function updateAssumptionStatus(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  if (!id || !status) return { error: "ID and status are required" };
  if (!ASSUMPTION_STATUSES.includes(status as AssumptionStatus)) {
    return { error: `Invalid assumption status: ${status}` };
  }

  try {
    await prisma.assumption.update({
      where: { id },
      data: { status: status as AssumptionStatus },
    });
  } catch (e) {
    console.error("[admin] updateAssumptionStatus failed:", e);
    return { error: "Failed to update assumption." };
  }

  revalidateAdmin();
  return { success: true };
}

export async function deleteAssumption(id: string) {
  await requireAdmin();
  try {
    await prisma.assumption.delete({ where: { id } });
  } catch (e) {
    console.error("[admin] deleteAssumption failed:", e);
    return { error: "Failed to delete assumption." };
  }
  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdminStats() {
  await requireAdmin();
  const [userCount, projectCount, blockerCount, assumptionCount, aiRunCount, docCount] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.blocker.count(),
    prisma.assumption.count(),
    prisma.aIRun.count(),
    prisma.sourceDocument.count(),
  ]);
  return { userCount, projectCount, blockerCount, assumptionCount, aiRunCount, docCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// CSE FLEET — workload tracking
// ═══════════════════════════════════════════════════════════════════════════

export async function getCseFleet() {
  await requireAdmin();
  const cses = await prisma.user.findMany({
    where: { role: "CSE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      projects: {
        select: {
          id: true,
          name: true,
          primaryDomain: true,
          status: true,
          engagementStage: true,
          updatedAt: true,
          _count: { select: { phaseArtifacts: true, blockers: true, assumptions: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      _count: { select: { projects: true, ingestRuns: true } },
    },
  });

  return cses.map((cse) => {
    const activeBlockers = cse.projects.reduce((n, p) => n + p._count.blockers, 0);
    const pendingAssumptions = cse.projects.reduce((n, p) => n + p._count.assumptions, 0);
    const totalPhases = cse.projects.reduce((n, p) => n + p._count.phaseArtifacts, 0);
    return {
      ...cse,
      activeBlockers,
      pendingAssumptions,
      totalPhases,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIRAL NOTES
// ═══════════════════════════════════════════════════════════════════════════

const noteContentSchema = z.string().min(1, "Note content is required").max(5000);

export async function getAdmiralNotes(options?: { projectId?: string; scope?: string; cseUserId?: string }) {
  await requireAdmin();
  const where: Record<string, unknown> = {};
  if (options?.projectId) where.projectId = options.projectId;
  if (options?.scope) where.scope = options.scope;
  if (options?.cseUserId) where.cseUserId = options.cseUserId;

  return prisma.admiralNote.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { name: true, email: true } },
      project: { select: { id: true, name: true } },
      cseUser: { select: { id: true, name: true } },
    },
  });
}

export async function createAdmiralNote(data: {
  content: string;
  projectId?: string;
  cseUserId?: string;
  phase?: string;
  scope?: string;
}) {
  const session = await requireAdmin();
  const parsed = noteContentSchema.safeParse(data.content);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const note = await prisma.admiralNote.create({
    data: {
      authorId: session.userId!,
      content: parsed.data,
      projectId: data.projectId || null,
      cseUserId: data.cseUserId || null,
      phase: data.phase || null,
      scope: data.scope || "project",
    },
  });

  revalidateAdmin();
  return { success: true, noteId: note.id };
}

export async function toggleNotePin(noteId: string) {
  await requireAdmin();
  const note = await prisma.admiralNote.findUnique({ where: { id: noteId } });
  if (!note) return { error: "Note not found" };

  await prisma.admiralNote.update({
    where: { id: noteId },
    data: { pinned: !note.pinned },
  });

  revalidateAdmin();
  return { success: true };
}

export async function deleteAdmiralNote(noteId: string) {
  await requireAdmin();
  await prisma.admiralNote.delete({ where: { id: noteId } });
  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT MANAGEMENT — reassign, complete, reopen
// ═══════════════════════════════════════════════════════════════════════════

export async function reassignProject(projectId: string, newOwnerId: string) {
  await requireAdmin();
  if (!projectId || !newOwnerId) return { error: "Missing project or user ID" };

  const [project, newOwner] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.user.findUnique({ where: { id: newOwnerId } }),
  ]);
  if (!project) return { error: "Project not found" };
  if (!newOwner) return { error: "User not found" };

  await prisma.project.update({
    where: { id: projectId },
    data: { ownerUserId: newOwnerId },
  });

  import("@/lib/jira/client")
    .then(({ syncJiraAssignee }) => syncJiraAssignee(projectId, newOwnerId))
    .catch((err) => console.warn("[admin] Jira reassign failed:", err));

  revalidateAdmin();
  return { success: true };
}

export async function assignProject(projectId: string, cseId: string) {
  await requireAdmin();
  if (!projectId || !cseId) return { error: "Missing project or CSE ID" };

  const [project, cse] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, primaryDomain: true, ownerUserId: true, jiraIssueId: true } }),
    prisma.user.findUnique({ where: { id: cseId }, select: { id: true, name: true } }),
  ]);
  if (!project) return { error: "Project not found" };
  if (!cse) return { error: "CSE not found" };

  await prisma.project.update({
    where: { id: projectId },
    data: { ownerUserId: cseId, engagementStage: 1 },
  });

  if (project.jiraIssueId) {
    import("@/lib/jira/client")
      .then(({ syncJiraAssignee }) => syncJiraAssignee(projectId, cseId))
      .catch((err) => console.warn("[admin] Jira assign failed:", err));
  } else {
    setupJiraForAdminProject(cseId, projectId, project.name, project.primaryDomain || null);
  }

  revalidateAdmin();
  return { success: true, message: `${project.name} assigned to ${cse.name}` };
}

export async function unassignProject(projectId: string) {
  await requireAdmin();
  if (!projectId) return { error: "Missing project ID" };

  await prisma.project.update({
    where: { id: projectId },
    data: { ownerUserId: null, engagementStage: 0 },
  });

  revalidateAdmin();
  return { success: true };
}

export async function setProjectStatus(projectId: string, status: "active" | "completed" | "on_hold") {
  await requireAdmin();
  if (!projectId) return { error: "Missing project ID" };

  const data: Record<string, unknown> = { status };
  if (status === "completed") data.completedAt = new Date();
  if (status === "active") data.completedAt = null;

  await prisma.project.update({ where: { id: projectId }, data });

  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGAGEMENT STAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════

export async function setEngagementStage(projectId: string, stage: number) {
  const session = await requireAdmin();
  if (!projectId) return { error: "Missing project ID" };
  if (stage < 0 || stage > 6) return { error: "Stage must be 0-6" };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      engagementStage: stage,
      ...(stage === 6 ? { closedWonAt: new Date(), completedAt: new Date() } : {}),
    },
  });

  // Sync Jira ticket status (non-blocking)
  syncJiraStatusForStage(projectId, session.userId!, stage).catch((err) => {
    console.warn("[admin] Jira stage sync failed:", err);
  });

  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD LOG — save/retrieve per-project build logs stored as PhaseArtifact
// ═══════════════════════════════════════════════════════════════════════════

export async function saveBuildLog(projectId: string, data: Record<string, unknown>) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };

  const existing = await prisma.phaseArtifact.findFirst({
    where: { projectId, phase: "BUILD_LOG" },
    orderBy: { version: "desc" },
  });

  const version = existing ? existing.version + 1 : 1;

  await prisma.phaseArtifact.create({
    data: {
      projectId,
      phase: "BUILD_LOG",
      version,
      status: "CLEAN",
      contentJson: data as unknown as import("@prisma/client").Prisma.InputJsonValue,
      contentMarkdown: buildLogToMarkdown(data),
      lastComputedAt: new Date(),
    },
  });

  // XP: award points for delivering the build log
  import("@/lib/gamification/xp-engine").then(({ awardXp, XP_ACTIONS }) => {
    awardXp(session.userId!, XP_ACTIONS.BUILD_LOG_DELIVERED.action, XP_ACTIONS.BUILD_LOG_DELIVERED.points, projectId).catch(() => {});
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}/buildlog`);
  return { success: true, version };
}

export async function getBuildLog(projectId: string) {
  return prisma.phaseArtifact.findFirst({
    where: { projectId, phase: "BUILD_LOG" },
    orderBy: { version: "desc" },
  });
}

function buildLogToMarkdown(data: Record<string, unknown>): string {
  const ctx = (data.context ?? {}) as Record<string, string>;
  const env = (data.environmentBaseline ?? {}) as Record<string, string>;
  const lines: string[] = ["# Build Log\n"];

  lines.push("## Context");
  lines.push(`- **SE / CSE:** ${ctx.seCse || ctx.aeCse || "—"}`);
  lines.push(`- **Executive Sponsor:** ${ctx.executiveSponsor || "—"}`);
  lines.push(`- **Customer Technical Lead:** ${ctx.customerTechnicalLead || "—"}`);
  lines.push(`- **Pilot Timeline:** ${ctx.pilotTimeline || ctx.sprintDates || "—"}\n`);

  lines.push("## Use Case");
  lines.push(`**Summary:** ${data.useCaseOneSentence || "—"}\n`);
  lines.push(`${data.useCase || data.hypothesis || "—"}\n`);

  lines.push("## Success Criteria");
  const sc = Array.isArray(data.successCriteria) ? data.successCriteria : [];
  sc.forEach((c: string) => lines.push(`- ${c}`));
  lines.push("");

  lines.push("## Environment Baseline");
  lines.push(`- **SCM:** ${env.scm || "—"}`);
  lines.push(`- **CI/CD:** ${env.ciCd || "—"}`);
  lines.push(`- **Gateway:** ${env.gateway || "—"}`);
  lines.push(`- **Cloud:** ${env.cloud || "—"}`);
  lines.push(`- **Dev Portal / IDP:** ${env.devPortal || "—"}`);
  lines.push(`- **Secrets Management:** ${env.secretsManagement || "—"}`);
  lines.push(`- **Current Postman Usage:** ${env.currentPostmanUsage || "—"}`);
  lines.push(`- **v11/v12:** ${env.version || "—"}\n`);

  lines.push("## Internal Proof");
  const proof = Array.isArray(data.internalProof) ? data.internalProof : [];
  proof.forEach((p: string) => lines.push(`- ${p}`));
  lines.push("");

  lines.push("## What We Built");
  const built = Array.isArray(data.whatWeBuilt) ? data.whatWeBuilt : [];
  built.forEach((b: string) => lines.push(`- ${b}`));
  lines.push("");

  lines.push("## Value Unlocked");
  const val = Array.isArray(data.valueUnlocked) ? data.valueUnlocked : [];
  val.forEach((v: string) => lines.push(`- ${v}`));
  lines.push("");

  lines.push("## Reusable Patterns");
  const pat = Array.isArray(data.reusablePatterns) ? data.reusablePatterns : [];
  pat.forEach((p: string) => lines.push(`- ${p}`));
  lines.push("");

  lines.push("## Implementation Kit");
  const kit = Array.isArray(data.implementationKit) ? data.implementationKit : [];
  kit.forEach((k: string) => lines.push(`- ${k}`));
  lines.push("");

  lines.push("## Product Gaps / Risks");
  const gaps = Array.isArray(data.productGapsRisks) ? data.productGapsRisks : [];
  gaps.forEach((g: string) => lines.push(`- ${g}`));
  lines.push("");

  lines.push("## Case Study Summary");
  lines.push(`${data.caseStudySummary || "—"}\n`);

  lines.push("## Next Motion");
  lines.push(`${data.nextMotion || "—"}\n`);

  lines.push("## Next Steps");
  const next = Array.isArray(data.nextSteps) ? data.nextSteps : [];
  next.forEach((n: string) => lines.push(`- ${n}`));

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIRAL TASKS — assign tasks to CSEs
// ═══════════════════════════════════════════════════════════════════════════

const taskTitleSchema = z.string().min(1, "Title is required").max(500);

export async function getAdmiralTasks(options?: { assigneeId?: string; projectId?: string; status?: string }) {
  await requireAdmin();
  const where: Record<string, unknown> = {};
  if (options?.assigneeId) where.assigneeId = options.assigneeId;
  if (options?.projectId) where.projectId = options.projectId;
  if (options?.status) where.status = options.status;

  return prisma.admiralTask.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      author: { select: { name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });
}

export async function createAdmiralTask(data: {
  assigneeId: string;
  title: string;
  description?: string;
  priority?: string;
  projectId?: string;
  dueDate?: string;
}) {
  const session = await requireAdmin();
  const parsed = taskTitleSchema.safeParse(data.title);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const task = await prisma.admiralTask.create({
    data: {
      authorId: session.userId!,
      assigneeId: data.assigneeId,
      title: parsed.data,
      description: data.description || null,
      priority: data.priority || "medium",
      projectId: data.projectId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });

  revalidateAdmin();
  return { success: true, taskId: task.id };
}

export async function updateTaskStatus(taskId: string, status: string) {
  await requireAdmin();
  const data: Record<string, unknown> = { status };
  if (status === "completed") data.completedAt = new Date();
  if (status === "pending" || status === "in_progress") data.completedAt = null;

  const task = await prisma.admiralTask.update({
    where: { id: taskId },
    data,
    select: { assigneeId: true, projectId: true },
  });

  // XP: award the assignee for completing the task
  if (status === "completed" && task.assigneeId) {
    import("@/lib/gamification/xp-engine").then(({ awardXp, XP_ACTIONS }) => {
      awardXp(task.assigneeId!, XP_ACTIONS.TASK_COMPLETED.action, XP_ACTIONS.TASK_COMPLETED.points, task.projectId).catch(() => {});
    }).catch(() => {});
  }

  revalidateAdmin();
  return { success: true };
}

export async function deleteAdmiralTask(taskId: string) {
  await requireAdmin();
  await prisma.admiralTask.delete({ where: { id: taskId } });
  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// CSE DETAIL — single CSE with full data
// ═══════════════════════════════════════════════════════════════════════════

export async function getCseDetail(cseId: string) {
  await requireAdmin();
  const cse = await prisma.user.findUnique({
    where: { id: cseId },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      projects: {
        select: {
          id: true, name: true, primaryDomain: true, status: true,
          engagementStage: true, completedAt: true, updatedAt: true, createdAt: true,
          _count: { select: { phaseArtifacts: true, blockers: true, assumptions: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      _count: { select: { projects: true, ingestRuns: true } },
    },
  });
  if (!cse) return null;
  return cse;
}

export async function getCseList() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { role: "CSE" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSOLIDATED DASHBOARD DATA (Point 15)
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdmiralDashboardData() {
  await requireAdmin();
  const [stats, fleet, recentNotes, recentTasks] = await Promise.all([
    getAdminStats(),
    getCseFleet(),
    getAdmiralNotes({ scope: "dashboard" }),
    prisma.admiralTask.findMany({
      where: { status: { in: ["pending", "in_progress"] } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        author: { select: { name: true } },
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
  ]);
  return { stats, fleet, recentNotes, recentTasks };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUICK STAGE ADVANCE (Point 16)
// ═══════════════════════════════════════════════════════════════════════════

export async function advanceEngagementStage(projectId: string) {
  const session = await requireAdmin();
  if (!projectId) return { error: "Missing project ID" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { engagementStage: true, ownerUserId: true },
  });
  if (!project) return { error: "Project not found" };

  if (!project.ownerUserId) {
    return { needsAssignment: true as const, projectId };
  }

  const nextStage = (project.engagementStage ?? 0) + 1;
  if (nextStage > 6) return { error: "Already at final stage" };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      engagementStage: nextStage,
      ...(nextStage === 6 ? { closedWonAt: new Date(), completedAt: new Date() } : {}),
    },
  });

  // Sync Jira ticket status (non-blocking)
  syncJiraStatusForStage(projectId, session.userId!, nextStage).catch((err) => {
    console.warn("[admin] Jira stage sync failed:", err);
  });

  revalidateAdmin();
  return { success: true, newStage: nextStage };
}

export async function assignAndAdvanceProject(projectId: string, cseId: string) {
  const session = await requireAdmin();
  if (!projectId || !cseId) return { error: "Missing project or CSE ID" };

  const [project, cse] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, primaryDomain: true, engagementStage: true } }),
    prisma.user.findUnique({ where: { id: cseId }, select: { id: true, name: true } }),
  ]);
  if (!project) return { error: "Project not found" };
  if (!cse) return { error: "CSE not found" };

  const nextStage = Math.max(1, (project.engagementStage ?? 0) + 1);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      ownerUserId: cseId,
      engagementStage: nextStage,
      ...(nextStage === 6 ? { closedWonAt: new Date(), completedAt: new Date() } : {}),
    },
  });

  setupJiraForAdminProject(cseId, projectId, project.name, project.primaryDomain || null);

  syncJiraStatusForStage(projectId, session.userId!, nextStage).catch((err) => {
    console.warn("[admin] Jira stage sync failed:", err);
  });

  revalidateAdmin();
  return { success: true, newStage: nextStage, message: `${project.name} assigned to ${cse.name} and advanced to S${nextStage}` };
}

// ═══════════════════════════════════════════════════════════════════════════
// FLEET CASCADE HEALTH (Point 18)
// ═══════════════════════════════════════════════════════════════════════════

export async function getFleetCascadeHealth() {
  await requireAdmin();

  const artifacts = await prisma.phaseArtifact.findMany({
    select: {
      projectId: true,
      phase: true,
      status: true,
      lastComputedAt: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: { lastComputedAt: "desc" },
  });

  const byProject = new Map<string, {
    projectId: string;
    projectName: string;
    clean: number;
    dirty: number;
    stale: number;
    other: number;
    lastCascadeRun: Date | null;
  }>();

  for (const a of artifacts) {
    let entry = byProject.get(a.projectId);
    if (!entry) {
      entry = {
        projectId: a.projectId,
        projectName: a.project.name,
        clean: 0, dirty: 0, stale: 0, other: 0,
        lastCascadeRun: null,
      };
      byProject.set(a.projectId, entry);
    }
    if (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS") entry.clean++;
    else if (a.status === "DIRTY") entry.dirty++;
    else if (a.status === "STALE") entry.stale++;
    else entry.other++;

    if (a.lastComputedAt && (!entry.lastCascadeRun || a.lastComputedAt > entry.lastCascadeRun)) {
      entry.lastCascadeRun = a.lastComputedAt;
    }
  }

  return Array.from(byProject.values());
}

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL BLOCKER COUNT (Point 19)
// ═══════════════════════════════════════════════════════════════════════════

export async function getCriticalBlockerCount() {
  await requireAdmin();
  return prisma.blocker.count({
    where: { severity: "CRITICAL", status: { notIn: ["NEUTRALIZED", "ACCEPTED"] } },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// JIRA BOARD SETUP & DIGEST
// ═══════════════════════════════════════════════════════════════════════════

export async function setupJiraLeadershipBoard(jiraProjectKey: string) {
  const session = await requireAdmin();
  const { getJiraCredentials } = await import("@/lib/jira/client");
  const creds = await getJiraCredentials(session.userId!);
  if (!creds) return { error: "No Jira credentials configured. Go to Settings to add them." };

  const { setupLeadershipBoard } = await import("@/lib/jira/board-setup");
  const result = await setupLeadershipBoard(creds, jiraProjectKey);
  return result;
}

export async function getWeeklyDigest() {
  await requireAdmin();
  const { generateWeeklyDigest, formatDigestAsMarkdown } = await import("@/lib/jira/digest");
  const data = await generateWeeklyDigest();
  const markdown = formatDigestAsMarkdown(data);
  return { data, markdown };
}

export async function getJiraKanbanData() {
  await requireAdmin();

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      primaryDomain: true,
      engagementStage: true,
      status: true,
      completedAt: true,
      closedWonAt: true,
      createdAt: true,
      updatedAt: true,
      jiraIssueKey: true,
      jiraIssueId: true,
      slackWebhookUrl: true,
      owner: { select: { id: true, name: true, email: true, jiraBaseUrl: true } },
      _count: {
        select: { blockers: true, assumptions: true, phaseArtifacts: true },
      },
      blockers: {
        where: { status: { notIn: ["NEUTRALIZED", "ACCEPTED", "DORMANT"] } },
        select: { severity: true },
      },
      phaseArtifacts: {
        distinct: ["phase"],
        orderBy: { version: "desc" },
        select: { phase: true, status: true },
      },
    },
  });

  return projects.map((p) => {
    const cleanPhases = p.phaseArtifacts.filter(
      (a) => a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS",
    ).length;
    const hasCritical = p.blockers.some((b) => b.severity === "CRITICAL");
    const hasHigh = p.blockers.some((b) => b.severity === "HIGH");

    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      id: p.id,
      name: p.name,
      domain: p.primaryDomain,
      stage: p.engagementStage,
      status: p.status,
      completedAt: p.completedAt?.toISOString() ?? null,
      closedWonAt: p.closedWonAt?.toISOString() ?? null,
      jiraIssueKey: p.jiraIssueKey,
      jiraBaseUrl: p.owner?.jiraBaseUrl ?? null,
      owner: p.owner ? { id: p.owner.id, name: p.owner.name, email: p.owner.email } : null,
      phasesComplete: cleanPhases,
      totalPhases: 10,
      activeBlockers: p.blockers.length,
      hasCritical,
      hasHigh,
      daysSinceUpdate,
      daysSinceCreation,
      hasSlack: !!p.slackWebhookUrl,
    };
  });
}
