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
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { BlockerSeverity, BlockerStatus, AssumptionStatus } from "@prisma/client";

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
  if (!session.userId || !session.isAdmin) {
    throw new Error("Admin access required");
  }
  return session;
}

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

// ═══════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════

export async function getUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true, isAdmin: true,
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
  const isAdmin = formData.get("isAdmin") === "on";

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
      data: { email: emailResult.data, name: nameResult.data, passwordHash, isAdmin },
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
          adoptionTeams: true, adoptionWaves: true, dripCampaigns: true,
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
          adoptionTeams: true, adoptionWaves: true, dripCampaigns: true,
          adoptionMilestones: true,
        },
      },
    },
  });
}

export async function createProject(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const primaryDomain = formData.get("primaryDomain") as string;
  const ownerUserId = formData.get("ownerUserId") as string;

  if (!name || !ownerUserId) return { error: "Name and owner are required" };
  if (name.length > 255) return { error: "Name is too long (max 255 characters)" };

  try {
    await prisma.project.create({
      data: { name, primaryDomain: primaryDomain || null, ownerUserId },
    });
  } catch (e) {
    console.error("[admin] createProject failed:", e);
    return { error: "Failed to create project." };
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
  await requireAdmin();
  try {
    await prisma.project.delete({ where: { id } });
  } catch (e) {
    console.error("[admin] deleteProject failed:", e);
    return { error: "Failed to delete project. It may have dependent records." };
  }
  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADOPTION TEAMS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdminTeams(projectId?: string) {
  await requireAdmin();
  return prisma.adoptionTeam.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { name: true } },
      wave: { select: { name: true, waveNumber: true } },
    },
  });
}

export async function createTeam(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const department = formData.get("department") as string;
  const teamSize = parseInt(formData.get("teamSize") as string) || 0;
  const teamLead = formData.get("teamLead") as string;
  const ciPlatform = formData.get("ciPlatform") as string;
  const waveId = formData.get("waveId") as string;

  if (!projectId || !name) return { error: "Project and name are required" };
  if (name.length > 255) return { error: "Name is too long (max 255 characters)" };

  try {
    await prisma.adoptionTeam.create({
      data: {
        projectId, name,
        department: department || null,
        teamSize: Math.max(0, Math.min(teamSize, 100000)),
        teamLead: teamLead || null,
        ciPlatform: ciPlatform || null,
        waveId: waveId || null,
      },
    });
  } catch (e) {
    console.error("[admin] createTeam failed:", e);
    return { error: "Failed to create team." };
  }

  revalidateAdmin();
  return { success: true };
}

export async function updateTeam(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const department = formData.get("department") as string;
  const teamSize = parseInt(formData.get("teamSize") as string) || 0;
  const teamLead = formData.get("teamLead") as string;
  const ciPlatform = formData.get("ciPlatform") as string;
  const adoptionStage = formData.get("adoptionStage") as string;
  const resistanceLevel = formData.get("resistanceLevel") as string;
  const championName = formData.get("championName") as string;

  if (!id || !name) return { error: "Name is required" };
  if (name.length > 255) return { error: "Name is too long (max 255 characters)" };

  try {
    await prisma.adoptionTeam.update({
      where: { id },
      data: {
        name, department: department || null,
        teamSize: Math.max(0, Math.min(teamSize, 100000)),
        teamLead: teamLead || null,
        ciPlatform: ciPlatform || null,
        adoptionStage: adoptionStage || "unaware",
        resistanceLevel: resistanceLevel || "none",
        championName: championName || null,
      },
    });
  } catch (e) {
    console.error("[admin] updateTeam failed:", e);
    return { error: "Failed to update team." };
  }

  revalidateAdmin();
  return { success: true };
}

export async function deleteTeam(id: string) {
  await requireAdmin();
  try {
    await prisma.adoptionTeam.delete({ where: { id } });
  } catch (e) {
    console.error("[admin] deleteTeam failed:", e);
    return { error: "Failed to delete team." };
  }
  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADOPTION WAVES
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdminWaves(projectId?: string) {
  await requireAdmin();
  return prisma.adoptionWave.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ projectId: "asc" }, { waveNumber: "asc" }],
    include: {
      project: { select: { name: true } },
      _count: { select: { teams: true, dripCampaigns: true } },
    },
  });
}

export async function createWave(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!projectId || !name) return { error: "Project and name are required" };
  if (name.length > 255) return { error: "Name is too long (max 255 characters)" };

  try {
    const maxWave = await prisma.adoptionWave.findFirst({
      where: { projectId }, orderBy: { waveNumber: "desc" }, select: { waveNumber: true },
    });

    await prisma.adoptionWave.create({
      data: {
        projectId, name,
        waveNumber: (maxWave?.waveNumber ?? 0) + 1,
        description: description || null,
      },
    });
  } catch (e) {
    console.error("[admin] createWave failed:", e);
    return { error: "Failed to create wave." };
  }

  revalidateAdmin();
  return { success: true };
}

export async function deleteWave(id: string) {
  await requireAdmin();
  try {
    await prisma.adoptionWave.delete({ where: { id } });
  } catch (e) {
    console.error("[admin] deleteWave failed:", e);
    return { error: "Failed to delete wave. It may have associated teams or campaigns." };
  }
  revalidateAdmin();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIP CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdminCampaigns(projectId?: string) {
  await requireAdmin();
  return prisma.dripCampaign.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { name: true } },
      wave: { select: { name: true, waveNumber: true } },
    },
  });
}

export async function deleteCampaign(id: string) {
  await requireAdmin();
  try {
    await prisma.dripCampaign.delete({ where: { id } });
  } catch (e) {
    console.error("[admin] deleteCampaign failed:", e);
    return { error: "Failed to delete campaign." };
  }
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
  const [userCount, projectCount, teamCount, waveCount, campaignCount, blockerCount, assumptionCount, milestoneCount, aiRunCount, docCount] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.adoptionTeam.count(),
    prisma.adoptionWave.count(),
    prisma.dripCampaign.count(),
    prisma.blocker.count(),
    prisma.assumption.count(),
    prisma.adoptionMilestone.count(),
    prisma.aIRun.count(),
    prisma.sourceDocument.count(),
  ]);
  return { userCount, projectCount, teamCount, waveCount, campaignCount, blockerCount, assumptionCount, milestoneCount, aiRunCount, docCount };
}
