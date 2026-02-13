"use server";

/**
 * Wide Adoption Accelerator — Server Actions
 *
 * All user-facing actions for the adoption acceleration system:
 * waves, teams, drip campaigns, milestones, and AI-powered generation.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import {
  createWave, clearWaveGate, launchWave, completeWave,
  addTeam, updateTeamMetrics, designateChampion,
  createDripCampaign, activateDripCampaign, advanceDripStep,
  celebrateMilestone, detectMilestones,
  runReadinessAssessment, updateTeamRoi,
  addFrictionPoint,
  generateExecutiveDashboard, getMomentumMetrics,
  getAdoptionHeatMap, getChampionNetwork,
  generatePollinationPairings, harvestSuccessStory,
  detectResistancePatterns,
} from "@/lib/adoption/engine";
import {
  generateOnboardingPlaybook,
  generateIntegrationBlueprint,
  designDripCampaign,
  generateWideAdoptionStrategy,
} from "@/lib/adoption/planner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, ownerUserId: userId },
    select: { id: true },
  });
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/adoption`);
  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// Wave Management
// ---------------------------------------------------------------------------

export async function createWaveAction(
  projectId: string,
  data: {
    name: string;
    description?: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
    targetTeamCount?: number;
    goNoGoGate?: Array<{ criterion: string; met: boolean; evidence: string }>;
  }
) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };

  const id = await createWave(projectId, {
    ...data,
    plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : undefined,
    plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : undefined,
  });
  revalidate(projectId);
  return { success: true, waveId: id };
}

export async function clearWaveGateAction(waveId: string) {
  const session = await requireAuth();
  const wave = await prisma.adoptionWave.findUnique({
    where: { id: waveId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!wave || wave.project.ownerUserId !== session.userId) return { error: "Not found" };

  const result = await clearWaveGate(waveId, session.userId);
  if (result.success) revalidate(wave.projectId);
  return result;
}

export async function launchWaveAction(waveId: string) {
  const session = await requireAuth();
  const wave = await prisma.adoptionWave.findUnique({
    where: { id: waveId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!wave || wave.project.ownerUserId !== session.userId) return { error: "Not found" };

  const result = await launchWave(waveId);
  if (result.success) revalidate(wave.projectId);
  return result;
}

export async function completeWaveAction(waveId: string) {
  const session = await requireAuth();
  const wave = await prisma.adoptionWave.findUnique({
    where: { id: waveId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!wave || wave.project.ownerUserId !== session.userId) return { error: "Not found" };

  await completeWave(waveId);
  revalidate(wave.projectId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Team Management
// ---------------------------------------------------------------------------

export async function addTeamAction(
  projectId: string,
  data: {
    name: string;
    department?: string;
    teamSize?: number;
    teamLead?: string;
    teamLeadEmail?: string;
    ciPlatform?: string;
    primaryLanguage?: string;
    waveId?: string;
    existingTools?: string[];
    integrationComplexity?: string;
  }
) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };

  const id = await addTeam(projectId, data);
  revalidate(projectId);
  return { success: true, teamId: id };
}

export async function updateTeamMetricsAction(
  teamId: string,
  metrics: {
    collectionsCreated?: number;
    testsWritten?: number;
    ciPipelinesActive?: number;
    activeUsers?: number;
    newmanRunsPerWeek?: number;
  }
) {
  const session = await requireAuth();
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!team || team.project.ownerUserId !== session.userId) return { error: "Not found" };

  const result = await updateTeamMetrics(teamId, metrics);
  revalidate(team.projectId);
  return result;
}

export async function designateChampionAction(
  teamId: string,
  championName: string,
  championEmail: string
) {
  const session = await requireAuth();
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!team || team.project.ownerUserId !== session.userId) return { error: "Not found" };

  await designateChampion(teamId, championName, championEmail);
  revalidate(team.projectId);
  return { success: true };
}

export async function addFrictionPointAction(teamId: string, frictionPoint: string) {
  const session = await requireAuth();
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!team || team.project.ownerUserId !== session.userId) return { error: "Not found" };

  await addFrictionPoint(teamId, frictionPoint);
  revalidate(team.projectId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Drip Campaigns
// ---------------------------------------------------------------------------

export async function createDripCampaignAction(
  projectId: string,
  data: {
    name: string;
    description?: string;
    targetAudience?: string;
    waveId?: string;
    cadence?: string;
    steps: Array<{ stepNumber: number; title: string; channel: "email" | "slack" | "meeting" | "workshop" | "documentation" | "demo"; content: string; delayDays: number; callToAction: string; resources: string[] }>;
  }
) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };

  const id = await createDripCampaign(projectId, data);
  revalidate(projectId);
  return { success: true, campaignId: id };
}

export async function activateDripCampaignAction(campaignId: string) {
  const session = await requireAuth();
  const campaign = await prisma.dripCampaign.findUnique({
    where: { id: campaignId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!campaign || campaign.project.ownerUserId !== session.userId) return { error: "Not found" };

  await activateDripCampaign(campaignId);
  revalidate(campaign.projectId);
  return { success: true };
}

export async function advanceDripStepAction(campaignId: string) {
  const session = await requireAuth();
  const campaign = await prisma.dripCampaign.findUnique({
    where: { id: campaignId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!campaign || campaign.project.ownerUserId !== session.userId) return { error: "Not found" };

  const result = await advanceDripStep(campaignId);
  revalidate(campaign.projectId);
  return { success: true, ...result };
}

// ---------------------------------------------------------------------------
// AI-Powered Generation
// ---------------------------------------------------------------------------

export async function generateOnboardingPlaybookAction(teamId: string) {
  const session = await requireAuth();
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!team || team.project.ownerUserId !== session.userId) return { error: "Not found" };

  try {
    const result = await generateOnboardingPlaybook(teamId);
    revalidate(team.projectId);
    return result;
  } catch (e) {
    console.error("[adoption] generateOnboardingPlaybook failed:", e);
    return { error: "AI generation failed. Please try again." };
  }
}

export async function generateIntegrationBlueprintAction(teamId: string) {
  const session = await requireAuth();
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!team || team.project.ownerUserId !== session.userId) return { error: "Not found" };

  try {
    const result = await generateIntegrationBlueprint(teamId);
    revalidate(team.projectId);
    return result;
  } catch (e) {
    console.error("[adoption] generateIntegrationBlueprint failed:", e);
    return { error: "AI generation failed. Please try again." };
  }
}

export async function designDripCampaignAction(projectId: string, targetAudience: string, waveId?: string) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };

  try {
    const result = await designDripCampaign(projectId, targetAudience, waveId);
    revalidate(projectId);
    return result;
  } catch (e) {
    console.error("[adoption] designDripCampaign failed:", e);
    return { error: "AI campaign design failed. Please try again." };
  }
}

export async function generateWideAdoptionStrategyAction(projectId: string) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };

  try {
    const result = await generateWideAdoptionStrategy(projectId);
    revalidate(projectId);
    return result;
  } catch (e) {
    console.error("[adoption] generateWideAdoptionStrategy failed:", e);
    return { error: "AI strategy generation failed. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Assessments & Analytics
// ---------------------------------------------------------------------------

export async function runReadinessAssessmentAction(teamId: string) {
  const session = await requireAuth();
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!team || team.project.ownerUserId !== session.userId) return { error: "Not found" };

  try {
    const assessment = await runReadinessAssessment(teamId);
    revalidate(team.projectId);
    return { success: true, assessment };
  } catch (e) {
    console.error("[adoption] runReadinessAssessment failed:", e);
    return { error: "Readiness assessment failed. Please try again." };
  }
}

export async function updateTeamRoiAction(teamId: string) {
  const session = await requireAuth();
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!team || team.project.ownerUserId !== session.userId) return { error: "Not found" };

  try {
    const roi = await updateTeamRoi(teamId);
    revalidate(team.projectId);
    return { success: true, roi };
  } catch (e) {
    console.error("[adoption] updateTeamRoi failed:", e);
    return { error: "ROI calculation failed. Please try again." };
  }
}

export async function detectResistancePatternsAction(teamId: string) {
  const session = await requireAuth();
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!team || team.project.ownerUserId !== session.userId) return { error: "Not found" };

  const patterns = detectResistancePatterns(team);
  return { success: true, patterns };
}

// ---------------------------------------------------------------------------
// Dashboard & Reports
// ---------------------------------------------------------------------------

export async function getExecutiveDashboardAction(projectId: string) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };
  return { success: true, dashboard: await generateExecutiveDashboard(projectId) };
}

export async function getMomentumAction(projectId: string) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };
  return { success: true, momentum: await getMomentumMetrics(projectId) };
}

export async function getHeatMapAction(projectId: string) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };
  return { success: true, heatMap: await getAdoptionHeatMap(projectId) };
}

export async function getChampionNetworkAction(projectId: string) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };
  return { success: true, champions: await getChampionNetwork(projectId) };
}

export async function getPollinationPairingsAction(projectId: string) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };
  return { success: true, pairings: await generatePollinationPairings(projectId) };
}

export async function harvestSuccessStoryAction(teamId: string) {
  const session = await requireAuth();
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { ownerUserId: true, id: true } } },
  });
  if (!team || team.project.ownerUserId !== session.userId) return { error: "Not found" };

  const story = await harvestSuccessStory(teamId);
  return { success: true, story };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function celebrateMilestoneAction(
  projectId: string,
  data: { type: string; title: string; description?: string; teamName?: string }
) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };

  const id = await celebrateMilestone(projectId, data);
  revalidate(projectId);
  return { success: true, milestoneId: id };
}

export async function detectMilestonesAction(projectId: string) {
  const session = await requireAuth();
  if (!(await verifyProject(projectId, session.userId))) return { error: "Not found" };

  const milestoneIds = await detectMilestones(projectId);
  revalidate(projectId);
  return { success: true, newMilestoneCount: milestoneIds.length, milestoneIds };
}
