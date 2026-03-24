/**
 * Blocker System Engine: Map → Missile → Nuke
 *
 * Three-tier approach to handling engagement blockers:
 *
 * 1. BLOCKER MAPPING — Identify, categorize, score, and map blockers.
 *    Understand the who, what, why, and how-bad of every obstacle.
 *    Map the stakeholder landscape around each blocker.
 *
 * 2. BLOCKER MISSILE — Design a targeted, surgical intervention.
 *    A precision strike: specific audience, specific message, specific
 *    deliverable, with success criteria and fallback plans.
 *
 * 3. BLOCKER NUKE — When missiles fail, go nuclear.
 *    Comprehensive obliteration: executive escalation chains, multi-phase
 *    campaigns, full resource mobilization, or complete bypass strategies
 *    that make the blocker irrelevant.
 *
 * Blockers can be:
 * - Surfaced automatically by AI agents during phase analysis
 * - Created manually by the SE based on customer conversations
 * - Inferred from assumption verification failures
 *
 * The engine integrates with the cascade: blockers affect phase status,
 * and resolving blockers can unblock downstream phases.
 */

import { prisma } from "@/lib/prisma";
import {
  BlockerSeverity,
  BlockerStatus,
  BlockerDomain,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { BlockerDetection } from "@/lib/ai/agents/topologyTypes";
import { logger } from "@/lib/logger";
import { sendSlackAlert } from "@/lib/slack";

const log = logger.child("blockers.engine");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlockerMapView {
  id: string;
  title: string;
  description: string;
  domain: BlockerDomain;
  severity: BlockerSeverity;
  status: BlockerStatus;
  impactScore: number;
  blockedPhases: string[];
  blockedCapabilities: string[];
  rootCause: string | null;
  blockerOwner: string | null;
  decisionMaker: string | null;
  missileCount: number;
  nukeCount: number;
  createdAt: string;
}

export interface BlockerDashboard {
  totalBlockers: number;
  bySeverity: Record<string, number>;
  byDomain: Record<string, number>;
  byStatus: Record<string, number>;
  criticalBlockers: BlockerMapView[];
  activeBlockers: BlockerMapView[];
  resolvedBlockers: number;
  blockedPhaseCount: number;
  topBlockedPhases: Array<{ phase: string; blockerCount: number }>;
  overallRiskScore: number; // 0-100 composite
}

// ---------------------------------------------------------------------------
// Blocker Mapping: Create and analyze blockers
// ---------------------------------------------------------------------------

/**
 * Create a new blocker from manual input.
 */
export async function createBlocker(
  projectId: string,
  data: {
    title: string;
    description: string;
    domain: BlockerDomain;
    severity?: BlockerSeverity;
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
): Promise<string> {
  const blocker = await prisma.blocker.create({
    data: {
      projectId,
      title: data.title,
      description: data.description,
      domain: data.domain,
      severity: data.severity ?? "MEDIUM",
      status: "IDENTIFIED",
      rootCause: data.rootCause ?? null,
      rootCauseCategory: data.rootCauseCategory ?? null,
      blockerOwner: data.blockerOwner ?? null,
      decisionMaker: data.decisionMaker ?? null,
      blockedPhases: (data.blockedPhases ?? []) as Prisma.InputJsonValue,
      blockedCapabilities: (data.blockedCapabilities ?? []) as Prisma.InputJsonValue,
      notes: data.notes ?? null,
      allies: (data.allies ?? []) as Prisma.InputJsonValue,
      resistors: (data.resistors ?? []) as Prisma.InputJsonValue,
      impactScore: computeImpactScore(
        data.severity ?? "MEDIUM",
        data.blockedPhases?.length ?? 0,
        data.blockedCapabilities?.length ?? 0
      ),
    },
  });

  log.info("Blocker created", { id: blocker.id, title: data.title, severity: data.severity });

  const sev = data.severity ?? "MEDIUM";
  if (sev === "HIGH" || sev === "CRITICAL") {
    void notifySlackIfNeeded(projectId, { id: blocker.id, title: data.title, severity: sev, domain: data.domain });
  }

  return blocker.id;
}

/**
 * Persist blockers detected by AI agents during phase analysis.
 * Uses fuzzy title matching to prevent near-duplicate blockers.
 */
export async function persistDetectedBlockers(
  projectId: string,
  detections: BlockerDetection[],
  surfacedByPhase: string,
  surfacedByAgent: string
): Promise<string[]> {
  const ids: string[] = [];

  const allExisting = await prisma.blocker.findMany({
    where: { projectId },
    select: { id: true, title: true, status: true },
  });

  for (const d of detections) {
    const match = allExisting.find(
      (b) => isSimilarTitle(b.title, d.title),
    );

    if (match) {
      log.info("Skipping duplicate blocker (fuzzy match)", {
        newTitle: d.title,
        existingTitle: match.title,
        existingStatus: match.status,
      });
      ids.push(match.id);
      continue;
    }

    const severityMap: Record<string, BlockerSeverity> = {
      low: "LOW", medium: "MEDIUM", high: "HIGH", critical: "CRITICAL",
    };
    const domainMap: Record<string, BlockerDomain> = {
      technical: "TECHNICAL", organizational: "ORGANIZATIONAL",
      political: "POLITICAL", process: "PROCESS", knowledge: "KNOWLEDGE",
      security: "SECURITY", licensing: "LICENSING", cultural: "CULTURAL",
    };

    const severity = severityMap[d.severity] ?? "MEDIUM";

    const blocker = await prisma.blocker.create({
      data: {
        projectId,
        title: d.title,
        description: d.description,
        domain: domainMap[d.domain] ?? "TECHNICAL",
        severity,
        status: "IDENTIFIED",
        rootCause: d.rootCause,
        rootCauseCategory: d.rootCauseCategory,
        blockedPhases: d.blockedPhases as Prisma.InputJsonValue,
        blockedCapabilities: d.blockedCapabilities as Prisma.InputJsonValue,
        evidenceIds: d.evidenceIds as Prisma.InputJsonValue,
        surfacedByPhase,
        surfacedByAgent,
        impactScore: computeImpactScore(
          severity,
          d.blockedPhases.length,
          d.blockedCapabilities.length
        ),
      },
    });

    ids.push(blocker.id);
    log.info("AI-detected blocker persisted", {
      id: blocker.id,
      title: d.title,
      severity: d.severity,
      domain: d.domain,
    });

    // Auto-arm: design a nuke for every detected blocker
    try {
      const { designNuke } = await import("@/lib/blockers/nuke-strategist");
      const nukeResult = await designNuke(blocker.id);
      if ("nukeId" in nukeResult) {
        log.info("Auto-armed nuke for blocker", { blockerId: blocker.id, nukeId: nukeResult.nukeId });
      }
    } catch (nukeErr) {
      log.warn("Auto-arm nuke failed (non-fatal)", {
        blockerId: blocker.id,
        error: nukeErr instanceof Error ? nukeErr.message : String(nukeErr),
      });
    }
  }

  return ids;
}

/**
 * Update blocker mapping: add stakeholder info, root cause, etc.
 * Transitions from IDENTIFIED → MAPPED.
 */
export async function updateBlockerMapping(
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
): Promise<{ success: boolean; error?: string }> {
  const blocker = await prisma.blocker.findUnique({
    where: { id: blockerId },
  });
  if (!blocker) return { success: false, error: "Blocker not found" };

  await prisma.blocker.update({
    where: { id: blockerId },
    data: {
      status: "MAPPED",
      rootCause: mapping.rootCause ?? blocker.rootCause,
      rootCauseCategory: mapping.rootCauseCategory ?? blocker.rootCauseCategory,
      blockerOwner: mapping.blockerOwner ?? blocker.blockerOwner,
      decisionMaker: mapping.decisionMaker ?? blocker.decisionMaker,
      allies: mapping.allies ? (mapping.allies as Prisma.InputJsonValue) : (blocker.allies as Prisma.InputJsonValue ?? undefined),
      resistors: mapping.resistors ? (mapping.resistors as Prisma.InputJsonValue) : (blocker.resistors as Prisma.InputJsonValue ?? undefined),
      revenueImpact: mapping.revenueImpact ?? blocker.revenueImpact,
      timelineImpact: mapping.timelineImpact ?? blocker.timelineImpact,
      cascadeImpact: mapping.cascadeImpact ?? blocker.cascadeImpact,
      notes: mapping.notes ?? blocker.notes,
    },
  });

  log.info("Blocker mapping updated", { id: blockerId });
  return { success: true };
}

/**
 * Update blocker status.
 */
export async function updateBlockerStatus(
  blockerId: string,
  status: BlockerStatus,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const blocker = await prisma.blocker.findUnique({
    where: { id: blockerId },
  });
  if (!blocker) return { success: false, error: "Blocker not found" };

  const isResolved = status === "NEUTRALIZED" || status === "ACCEPTED";

  await prisma.blocker.update({
    where: { id: blockerId },
    data: {
      status,
      resolvedAt: isResolved ? new Date() : blocker.resolvedAt,
      resolutionNotes: isResolved ? (notes ?? blocker.resolutionNotes) : blocker.resolutionNotes,
    },
  });

  log.info("Blocker status updated", { id: blockerId, status });

  if ((blocker.severity === "HIGH" || blocker.severity === "CRITICAL") && !isResolved) {
    void notifySlackIfNeeded(blocker.projectId, {
      id: blockerId,
      title: blocker.title,
      severity: blocker.severity,
      domain: blocker.domain,
    });
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Missile Operations: Create, fire, assess
// ---------------------------------------------------------------------------

/**
 * Create a missile for a blocker (manual).
 */
export async function createMissile(
  blockerId: string,
  data: {
    name: string;
    strategy: string;
    targetAudience?: string;
    talkingPoints?: unknown[];
    actionSteps?: unknown[];
    deliverables?: unknown[];
    estimatedEffort?: string;
    deadline?: Date;
    successCriteria?: string;
    fallbackPlan?: string;
  }
): Promise<string> {
  const missile = await prisma.blockerMissile.create({
    data: {
      blockerId,
      name: data.name,
      strategy: data.strategy,
      targetAudience: data.targetAudience ?? null,
      talkingPoints: (data.talkingPoints ?? []) as Prisma.InputJsonValue,
      actionSteps: (data.actionSteps ?? []) as Prisma.InputJsonValue,
      deliverables: (data.deliverables ?? []) as Prisma.InputJsonValue,
      estimatedEffort: data.estimatedEffort ?? null,
      deadline: data.deadline ?? null,
      successCriteria: data.successCriteria ?? null,
      fallbackPlan: data.fallbackPlan ?? null,
      status: "designed",
    },
  });

  // Update blocker status
  await prisma.blocker.update({
    where: { id: blockerId },
    data: { status: "MISSILE_DESIGNED" },
  });

  log.info("Missile created", { id: missile.id, blockerId, name: data.name });
  return missile.id;
}

/**
 * Store an AI-generated missile design.
 */
export async function persistAiMissile(
  blockerId: string,
  design: {
    name: string;
    strategy: string;
    targetAudience: string;
    talkingPoints: unknown[];
    actionSteps: unknown[];
    deliverables: unknown[];
    estimatedEffort: string;
    successCriteria: string;
    fallbackPlan: string;
  },
  aiRunId: string
): Promise<string> {
  const missile = await prisma.blockerMissile.create({
    data: {
      blockerId,
      name: design.name,
      strategy: design.strategy,
      targetAudience: design.targetAudience,
      talkingPoints: design.talkingPoints as Prisma.InputJsonValue,
      actionSteps: design.actionSteps as Prisma.InputJsonValue,
      deliverables: design.deliverables as Prisma.InputJsonValue,
      estimatedEffort: design.estimatedEffort,
      successCriteria: design.successCriteria,
      fallbackPlan: design.fallbackPlan,
      status: "designed",
      aiGenerated: true,
      aiRunId,
    },
  });

  await prisma.blocker.update({
    where: { id: blockerId },
    data: { status: "MISSILE_DESIGNED" },
  });

  log.info("AI missile persisted", { id: missile.id, blockerId });
  return missile.id;
}

/**
 * Fire a missile — mark it as in progress.
 */
export async function fireMissile(
  missileId: string
): Promise<{ success: boolean; error?: string }> {
  const missile = await prisma.blockerMissile.findUnique({
    where: { id: missileId },
    include: { blocker: true },
  });
  if (!missile) return { success: false, error: "Missile not found" };

  await prisma.blockerMissile.update({
    where: { id: missileId },
    data: { status: "fired", firedAt: new Date() },
  });

  await prisma.blocker.update({
    where: { id: missile.blockerId },
    data: { status: "MISSILE_FIRED" },
  });

  log.info("Missile fired", { id: missileId, blockerId: missile.blockerId });
  return { success: true };
}

/**
 * Record the result of a fired missile.
 */
export async function recordMissileResult(
  missileId: string,
  result: "hit" | "missed",
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const missile = await prisma.blockerMissile.findUnique({
    where: { id: missileId },
  });
  if (!missile) return { success: false, error: "Missile not found" };

  await prisma.blockerMissile.update({
    where: { id: missileId },
    data: { status: result, resultNotes: notes },
  });

  if (result === "hit") {
    await prisma.blocker.update({
      where: { id: missile.blockerId },
      data: {
        status: "NEUTRALIZED",
        resolvedAt: new Date(),
        resolutionNotes: `Missile "${missile.name}" hit. ${notes}`,
      },
    });
  }

  log.info("Missile result recorded", { id: missileId, result });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Nuke Operations: Design, arm, launch
// ---------------------------------------------------------------------------

/**
 * Create a nuke strategy for a blocker (manual).
 */
export async function createNuke(
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
): Promise<string> {
  const nuke = await prisma.blockerNuke.create({
    data: {
      blockerId,
      name: data.name,
      rationale: data.rationale,
      strategy: data.strategy,
      escalationChain: (data.escalationChain ?? []) as Prisma.InputJsonValue,
      collateralDamage: (data.collateralDamage ?? []) as Prisma.InputJsonValue,
      riskAssessment: data.riskAssessment ?? null,
      pointOfNoReturn: data.pointOfNoReturn ?? null,
      phases: (data.phases ?? []) as Prisma.InputJsonValue,
      resources: (data.resources ?? []) as Prisma.InputJsonValue,
      timeline: data.timeline ?? null,
      bypassStrategy: data.bypassStrategy ?? null,
      bypassTradeoffs: data.bypassTradeoffs ?? null,
      successCriteria: data.successCriteria ?? null,
      failureContingency: data.failureContingency ?? null,
      status: "designed",
    },
  });

  await prisma.blocker.update({
    where: { id: blockerId },
    data: { status: "NUKE_ARMED" },
  });

  log.info("Nuke created", { id: nuke.id, blockerId });
  return nuke.id;
}

/**
 * Store an AI-generated nuke strategy.
 */
export async function persistAiNuke(
  blockerId: string,
  strategy: {
    name: string;
    rationale: string;
    strategy: string;
    escalationChain: unknown[];
    collateralDamage: unknown[];
    riskAssessment: string;
    pointOfNoReturn: string;
    phases: unknown[];
    resources: unknown[];
    timeline: string;
    bypassStrategy: string;
    bypassTradeoffs: string;
    successCriteria: string;
    failureContingency: string;
  },
  aiRunId: string
): Promise<string> {
  const nuke = await prisma.blockerNuke.create({
    data: {
      blockerId,
      name: strategy.name,
      rationale: strategy.rationale,
      strategy: strategy.strategy,
      escalationChain: strategy.escalationChain as Prisma.InputJsonValue,
      collateralDamage: strategy.collateralDamage as Prisma.InputJsonValue,
      riskAssessment: strategy.riskAssessment,
      pointOfNoReturn: strategy.pointOfNoReturn,
      phases: strategy.phases as Prisma.InputJsonValue,
      resources: strategy.resources as Prisma.InputJsonValue,
      timeline: strategy.timeline,
      bypassStrategy: strategy.bypassStrategy,
      bypassTradeoffs: strategy.bypassTradeoffs,
      successCriteria: strategy.successCriteria,
      failureContingency: strategy.failureContingency,
      status: "designed",
      aiGenerated: true,
      aiRunId,
    },
  });

  await prisma.blocker.update({
    where: { id: blockerId },
    data: { status: "NUKE_ARMED" },
  });

  log.info("AI nuke persisted", { id: nuke.id, blockerId });
  return nuke.id;
}

/**
 * Launch a nuke — point of no return.
 */
export async function launchNuke(
  nukeId: string
): Promise<{ success: boolean; error?: string }> {
  const nuke = await prisma.blockerNuke.findUnique({
    where: { id: nukeId },
  });
  if (!nuke) return { success: false, error: "Nuke not found" };

  await prisma.blockerNuke.update({
    where: { id: nukeId },
    data: { status: "launched", launchedAt: new Date() },
  });

  await prisma.blocker.update({
    where: { id: nuke.blockerId },
    data: { status: "NUKE_LAUNCHED" },
  });

  log.info("NUKE LAUNCHED", { id: nukeId, blockerId: nuke.blockerId });
  return { success: true };
}

/**
 * Record the result of a launched nuke.
 */
export async function recordNukeResult(
  nukeId: string,
  result: "detonated" | "failed",
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const nuke = await prisma.blockerNuke.findUnique({
    where: { id: nukeId },
  });
  if (!nuke) return { success: false, error: "Nuke not found" };

  await prisma.blockerNuke.update({
    where: { id: nukeId },
    data: { status: result, resultNotes: notes },
  });

  if (result === "detonated") {
    await prisma.blocker.update({
      where: { id: nuke.blockerId },
      data: {
        status: "NEUTRALIZED",
        resolvedAt: new Date(),
        resolutionNotes: `Nuke "${nuke.name}" detonated. ${notes}`,
      },
    });
  }

  log.info("Nuke result recorded", { id: nukeId, result });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Dashboard: Full blocker landscape view
// ---------------------------------------------------------------------------

/**
 * Get the full blocker dashboard for a project.
 */
export async function getBlockerDashboard(
  projectId: string
): Promise<BlockerDashboard> {
  const blockers = await prisma.blocker.findMany({
    where: { projectId },
    include: {
      missiles: { select: { id: true } },
      nukes: { select: { id: true } },
    },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
  });

  const bySeverity: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const phaseBlockerCount = new Map<string, number>();
  let resolvedCount = 0;

  const views: BlockerMapView[] = blockers.map((b) => {
    bySeverity[b.severity] = (bySeverity[b.severity] ?? 0) + 1;
    byDomain[b.domain] = (byDomain[b.domain] ?? 0) + 1;
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;

    if (b.status === "NEUTRALIZED" || b.status === "ACCEPTED") resolvedCount++;

    const phases = (b.blockedPhases as string[]) ?? [];
    for (const p of phases) {
      phaseBlockerCount.set(p, (phaseBlockerCount.get(p) ?? 0) + 1);
    }

    return {
      id: b.id,
      title: b.title,
      description: b.description,
      domain: b.domain,
      severity: b.severity,
      status: b.status,
      impactScore: b.impactScore,
      blockedPhases: phases,
      blockedCapabilities: (b.blockedCapabilities as string[]) ?? [],
      rootCause: b.rootCause,
      blockerOwner: b.blockerOwner,
      decisionMaker: b.decisionMaker,
      missileCount: b.missiles.length,
      nukeCount: b.nukes.length,
      createdAt: b.createdAt.toISOString(),
    };
  });

  const activeStatuses: BlockerStatus[] = [
    "IDENTIFIED", "MAPPED", "MISSILE_DESIGNED", "MISSILE_FIRED",
    "NUKE_ARMED", "NUKE_LAUNCHED",
  ];

  const activeBlockers = views.filter((b) =>
    activeStatuses.includes(b.status as BlockerStatus)
  );
  const criticalBlockers = activeBlockers.filter(
    (b) => b.severity === "CRITICAL" || b.severity === "HIGH"
  );

  // Top blocked phases
  const topBlockedPhases = [...phaseBlockerCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([phase, count]) => ({ phase, blockerCount: count }));

  // Overall risk score: 0-100
  const overallRiskScore = computeOverallRisk(activeBlockers);

  return {
    totalBlockers: blockers.length,
    bySeverity,
    byDomain,
    byStatus,
    criticalBlockers,
    activeBlockers,
    resolvedBlockers: resolvedCount,
    blockedPhaseCount: phaseBlockerCount.size,
    topBlockedPhases,
    overallRiskScore,
  };
}

/**
 * Get a single blocker with all its missiles and nukes.
 */
export async function getBlockerDetail(blockerId: string) {
  return prisma.blocker.findUnique({
    where: { id: blockerId },
    include: {
      missiles: { orderBy: { createdAt: "desc" } },
      nukes: { orderBy: { createdAt: "desc" } },
    },
  });
}

// ---------------------------------------------------------------------------
// Slack notification helper
// ---------------------------------------------------------------------------

async function notifySlackIfNeeded(projectId: string, blocker: { id: string; title: string; severity: string; domain: string }) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slackWebhookUrl: true, name: true },
    });
    if (!project?.slackWebhookUrl) return;

    await sendSlackAlert(project.slackWebhookUrl, {
      title: `Blocker Alert: ${blocker.title}`,
      text: `A *${blocker.severity}* blocker has been flagged in project *${project.name}*.`,
      color: blocker.severity === "CRITICAL" ? "#dc2626" : "#f59e0b",
      fields: [
        { title: "Severity", value: blocker.severity, short: true },
        { title: "Domain", value: blocker.domain, short: true },
      ],
      actionUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/projects/${projectId}/blockers`,
    });
  } catch (err) {
    log.warn("Slack notification failed", { projectId, blockerId: blocker.id, error: err });
  }
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function computeImpactScore(
  severity: BlockerSeverity | string,
  blockedPhaseCount: number,
  blockedCapabilityCount: number
): number {
  const severityWeight: Record<string, number> = {
    LOW: 10, MEDIUM: 30, HIGH: 60, CRITICAL: 90,
  };
  const base = severityWeight[severity] ?? 30;
  const phaseBonus = Math.min(blockedPhaseCount * 5, 30);
  const capBonus = Math.min(blockedCapabilityCount * 3, 20);
  return Math.min(base + phaseBonus + capBonus, 100);
}

function computeOverallRisk(activeBlockers: BlockerMapView[]): number {
  if (activeBlockers.length === 0) return 0;

  const weights: Record<string, number> = {
    CRITICAL: 40, HIGH: 25, MEDIUM: 12, LOW: 5,
  };

  let total = 0;
  for (const b of activeBlockers) {
    total += weights[b.severity] ?? 12;
  }

  return Math.min(total, 100);
}

/**
 * Fuzzy title similarity check for blocker dedup.
 * Extracts significant words from each title and computes Jaccard overlap.
 * Returns true if the titles are semantically similar enough to be the same blocker.
 */
function isSimilarTitle(a: string, b: string): boolean {
  if (a === b) return true;

  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const STOP_WORDS = new Set([
    "the", "and", "for", "with", "from", "that", "this", "are", "was",
    "has", "have", "not", "but", "its", "can", "may", "will", "into",
    "creates", "create", "based", "unknown", "lack",
  ]);

  const wordsA = new Set(normalize(a).filter((w) => !STOP_WORDS.has(w)));
  const wordsB = new Set(normalize(b).filter((w) => !STOP_WORDS.has(w)));

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = intersection / union;

  return jaccard >= 0.5;
}
