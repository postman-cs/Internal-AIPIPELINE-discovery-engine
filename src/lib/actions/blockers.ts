"use server";

/**
 * Blocker System — Server Actions
 *
 * Full CRUD + workflow for the Blocker → Missile → Nuke system.
 *
 * Actions:
 * - Blocker: create, update mapping, update status, list, get detail, dashboard
 * - Missile: create manual, design with AI, fire, record result
 * - Nuke: create manual, design with AI, arm, launch, record result
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { BlockerDomain, BlockerSeverity, BlockerStatus } from "@prisma/client";
import {
  createBlocker,
  updateBlockerMapping,
  updateBlockerStatus,
  createMissile,
  fireMissile,
  recordMissileResult,
  createNuke,
  launchNuke,
  recordNukeResult,
  getBlockerDashboard,
  getBlockerDetail,
} from "@/lib/blockers/engine";
import { designMissile } from "@/lib/blockers/missile-designer";
import { designNuke } from "@/lib/blockers/nuke-strategist";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyProjectOwnership(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, ownerUserId: userId },
    select: { id: true },
  });
}

async function verifyBlockerOwnership(blockerId: string, userId: string) {
  const blocker = await prisma.blocker.findUnique({
    where: { id: blockerId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!blocker) return null;
  if (blocker.project.ownerUserId !== userId) return null;
  return blocker;
}

function revalidateBlockerPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}/blockers`);
  revalidatePath(`/projects/${projectId}`);
}

const VALID_DOMAINS: string[] = ["TECHNICAL", "ORGANIZATIONAL", "POLITICAL", "FINANCIAL", "SECURITY", "COMPLIANCE", "CULTURAL", "RESOURCE", "PROCESS"];
const VALID_SEVERITIES: string[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const VALID_STATUSES: string[] = ["IDENTIFIED", "MAPPED", "MISSILE_DESIGNED", "MISSILE_FIRED", "NUKE_ARMED", "NUKE_LAUNCHED", "NEUTRALIZED", "ACCEPTED", "DORMANT"];

// ---------------------------------------------------------------------------
// Blocker CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new blocker manually.
 */
export async function createBlockerAction(
  projectId: string,
  data: {
    title: string;
    description: string;
    domain: string;
    severity?: string;
    rootCause?: string;
    rootCauseCategory?: string;
    blockerOwner?: string;
    decisionMaker?: string;
    blockedPhases?: string[];
    blockedCapabilities?: string[];
    notes?: string;
    allies?: string[];
    resistors?: string[];
  }
) {
  const session = await requireAuth();
  const project = await verifyProjectOwnership(projectId, session.userId);
  if (!project) return { error: "Project not found" };

  const domainUpper = data.domain.toUpperCase();
  if (!VALID_DOMAINS.includes(domainUpper)) return { error: `Invalid blocker domain: ${data.domain}` };
  if (data.severity && !VALID_SEVERITIES.includes(data.severity.toUpperCase())) return { error: `Invalid severity: ${data.severity}` };

  try {
    const id = await createBlocker(projectId, {
      ...data,
      domain: domainUpper as BlockerDomain,
      severity: data.severity ? (data.severity.toUpperCase() as BlockerSeverity) : undefined,
    });

    revalidateBlockerPaths(projectId);
    return { success: true, blockerId: id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create blocker" };
  }
}

/**
 * Update blocker mapping (stakeholders, root cause, impact).
 */
export async function updateBlockerMappingAction(
  blockerId: string,
  mapping: {
    rootCause?: string;
    rootCauseCategory?: string;
    blockerOwner?: string;
    decisionMaker?: string;
    allies?: string[];
    resistors?: string[];
    revenueImpact?: string;
    timelineImpact?: string;
    cascadeImpact?: string;
    notes?: string;
  }
) {
  const session = await requireAuth();
  const blocker = await verifyBlockerOwnership(blockerId, session.userId);
  if (!blocker) return { error: "Blocker not found or unauthorized" };

  const result = await updateBlockerMapping(blockerId, mapping);

  if (result.success) {
    revalidateBlockerPaths(blocker.projectId);
  }

  return result;
}

/**
 * Update blocker status.
 */
export async function updateBlockerStatusAction(
  blockerId: string,
  status: string,
  notes?: string
) {
  if (!VALID_STATUSES.includes(status)) return { error: `Invalid blocker status: ${status}` };

  const session = await requireAuth();
  const blocker = await verifyBlockerOwnership(blockerId, session.userId);
  if (!blocker) return { error: "Blocker not found or unauthorized" };

  const result = await updateBlockerStatus(
    blockerId,
    status as BlockerStatus,
    notes
  );

  if (result.success) {
    revalidateBlockerPaths(blocker.projectId);
  }

  return result;
}

/**
 * Get the full blocker dashboard for a project.
 */
export async function getBlockerDashboardAction(projectId: string) {
  const session = await requireAuth();
  const project = await verifyProjectOwnership(projectId, session.userId);
  if (!project) return { error: "Project not found" };

  const dashboard = await getBlockerDashboard(projectId);
  return { success: true, dashboard };
}

/**
 * Get a single blocker with full detail (missiles + nukes).
 */
export async function getBlockerDetailAction(blockerId: string) {
  const session = await requireAuth();
  const blocker = await verifyBlockerOwnership(blockerId, session.userId);
  if (!blocker) return { error: "Blocker not found or unauthorized" };

  const detail = await getBlockerDetail(blockerId);
  if (!detail) return { error: "Blocker not found" };

  return {
    success: true,
    blocker: {
      id: detail.id,
      title: detail.title,
      description: detail.description,
      domain: detail.domain,
      severity: detail.severity,
      status: detail.status,
      impactScore: detail.impactScore,
      rootCause: detail.rootCause,
      rootCauseCategory: detail.rootCauseCategory,
      blockerOwner: detail.blockerOwner,
      decisionMaker: detail.decisionMaker,
      allies: detail.allies,
      resistors: detail.resistors,
      blockedPhases: detail.blockedPhases,
      blockedCapabilities: detail.blockedCapabilities,
      revenueImpact: detail.revenueImpact,
      timelineImpact: detail.timelineImpact,
      cascadeImpact: detail.cascadeImpact,
      surfacedByPhase: detail.surfacedByPhase,
      surfacedByAgent: detail.surfacedByAgent,
      evidenceIds: detail.evidenceIds,
      notes: detail.notes,
      resolvedAt: detail.resolvedAt?.toISOString() ?? null,
      resolutionNotes: detail.resolutionNotes,
      createdAt: detail.createdAt.toISOString(),
      missiles: detail.missiles.map((m) => ({
        id: m.id,
        name: m.name,
        strategy: m.strategy,
        targetAudience: m.targetAudience,
        talkingPoints: m.talkingPoints,
        actionSteps: m.actionSteps,
        deliverables: m.deliverables,
        estimatedEffort: m.estimatedEffort,
        deadline: m.deadline?.toISOString() ?? null,
        successCriteria: m.successCriteria,
        fallbackPlan: m.fallbackPlan,
        status: m.status,
        firedAt: m.firedAt?.toISOString() ?? null,
        resultNotes: m.resultNotes,
        aiGenerated: m.aiGenerated,
        createdAt: m.createdAt.toISOString(),
      })),
      nukes: detail.nukes.map((n) => ({
        id: n.id,
        name: n.name,
        rationale: n.rationale,
        strategy: n.strategy,
        escalationChain: n.escalationChain,
        collateralDamage: n.collateralDamage,
        riskAssessment: n.riskAssessment,
        pointOfNoReturn: n.pointOfNoReturn,
        phases: n.phases,
        resources: n.resources,
        timeline: n.timeline,
        bypassStrategy: n.bypassStrategy,
        bypassTradeoffs: n.bypassTradeoffs,
        successCriteria: n.successCriteria,
        failureContingency: n.failureContingency,
        status: n.status,
        armedAt: n.armedAt?.toISOString() ?? null,
        launchedAt: n.launchedAt?.toISOString() ?? null,
        resultNotes: n.resultNotes,
        aiGenerated: n.aiGenerated,
        createdAt: n.createdAt.toISOString(),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Missile Actions
// ---------------------------------------------------------------------------

/**
 * Create a missile manually.
 */
export async function createMissileAction(
  blockerId: string,
  data: {
    name: string;
    strategy: string;
    targetAudience?: string;
    talkingPoints?: unknown[];
    actionSteps?: unknown[];
    deliverables?: unknown[];
    estimatedEffort?: string;
    successCriteria?: string;
    fallbackPlan?: string;
  }
) {
  const session = await requireAuth();
  const blocker = await verifyBlockerOwnership(blockerId, session.userId);
  if (!blocker) return { error: "Blocker not found or unauthorized" };

  try {
    const id = await createMissile(blockerId, data);
    revalidateBlockerPaths(blocker.projectId);
    return { success: true, missileId: id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create missile" };
  }
}

/**
 * Use AI to design a precision missile for a blocker.
 */
export async function designMissileAction(blockerId: string) {
  const session = await requireAuth();
  const blocker = await verifyBlockerOwnership(blockerId, session.userId);
  if (!blocker) return { error: "Blocker not found or unauthorized" };

  try {
    const result = await designMissile(blockerId);
    if ("error" in result) return result;

    revalidateBlockerPaths(blocker.projectId);
    return {
      success: true,
      missileId: result.missileId,
      design: result.design,
      aiRunId: result.aiRunId,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to design missile" };
  }
}

/**
 * Fire a missile — execute the intervention.
 */
export async function fireMissileAction(missileId: string) {
  const session = await requireAuth();

  const missile = await prisma.blockerMissile.findUnique({
    where: { id: missileId },
    include: { blocker: { include: { project: { select: { ownerUserId: true, id: true } } } } },
  });
  if (!missile || missile.blocker.project.ownerUserId !== session.userId) {
    return { error: "Missile not found or unauthorized" };
  }

  const result = await fireMissile(missileId);

  if (result.success) {
    revalidateBlockerPaths(missile.blocker.projectId);
  }

  return result;
}

/**
 * Record the result of a fired missile.
 */
export async function recordMissileResultAction(
  missileId: string,
  result: "hit" | "missed",
  notes: string
) {
  const session = await requireAuth();

  const missile = await prisma.blockerMissile.findUnique({
    where: { id: missileId },
    include: { blocker: { include: { project: { select: { ownerUserId: true, id: true } } } } },
  });
  if (!missile || missile.blocker.project.ownerUserId !== session.userId) {
    return { error: "Missile not found or unauthorized" };
  }

  const res = await recordMissileResult(missileId, result, notes);

  if (res.success) {
    revalidateBlockerPaths(missile.blocker.projectId);
  }

  return res;
}

// ---------------------------------------------------------------------------
// Nuke Actions
// ---------------------------------------------------------------------------

/**
 * Create a nuke strategy manually.
 */
export async function createNukeAction(
  blockerId: string,
  data: {
    name: string;
    rationale: string;
    strategy: string;
    escalationChain?: unknown[];
    collateralDamage?: unknown[];
    riskAssessment?: string;
    pointOfNoReturn?: string;
    phases?: unknown[];
    resources?: unknown[];
    timeline?: string;
    bypassStrategy?: string;
    bypassTradeoffs?: string;
    successCriteria?: string;
    failureContingency?: string;
  }
) {
  const session = await requireAuth();
  const blocker = await verifyBlockerOwnership(blockerId, session.userId);
  if (!blocker) return { error: "Blocker not found or unauthorized" };

  try {
    const id = await createNuke(blockerId, data);
    revalidateBlockerPaths(blocker.projectId);
    return { success: true, nukeId: id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create nuke" };
  }
}

/**
 * Use AI to design a comprehensive nuke strategy for a blocker.
 */
export async function designNukeAction(blockerId: string) {
  const session = await requireAuth();
  const blocker = await verifyBlockerOwnership(blockerId, session.userId);
  if (!blocker) return { error: "Blocker not found or unauthorized" };

  try {
    const result = await designNuke(blockerId);
    if ("error" in result) return result;

    revalidateBlockerPaths(blocker.projectId);
    return {
      success: true,
      nukeId: result.nukeId,
      strategy: result.strategy,
      aiRunId: result.aiRunId,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to design nuke" };
  }
}

/**
 * Launch a nuke — point of no return.
 */
export async function launchNukeAction(nukeId: string) {
  const session = await requireAuth();

  const nuke = await prisma.blockerNuke.findUnique({
    where: { id: nukeId },
    include: { blocker: { include: { project: { select: { ownerUserId: true, id: true } } } } },
  });
  if (!nuke || nuke.blocker.project.ownerUserId !== session.userId) {
    return { error: "Nuke not found or unauthorized" };
  }

  const result = await launchNuke(nukeId);

  if (result.success) {
    revalidateBlockerPaths(nuke.blocker.projectId);
  }

  return result;
}

/**
 * Record the result of a launched nuke.
 */
export async function recordNukeResultAction(
  nukeId: string,
  result: "detonated" | "failed",
  notes: string
) {
  const session = await requireAuth();

  const nuke = await prisma.blockerNuke.findUnique({
    where: { id: nukeId },
    include: { blocker: { include: { project: { select: { ownerUserId: true, id: true } } } } },
  });
  if (!nuke || nuke.blocker.project.ownerUserId !== session.userId) {
    return { error: "Nuke not found or unauthorized" };
  }

  const res = await recordNukeResult(nukeId, result, notes);

  if (res.success) {
    revalidateBlockerPaths(nuke.blocker.projectId);
  }

  return res;
}
