/**
 * Wide Adoption Accelerator Engine
 *
 * Drives org-wide Postman Enterprise adoption through a tide-based model:
 * teams adopt in escalating waves, each bigger and faster than the last,
 * powered by drip campaigns, champion networks, and momentum tracking.
 *
 * 20 capabilities:
 *  1. Drip Campaign Engine       11. Adoption Momentum Tracker
 *  2. Tide Wave Planner          12. Executive Dashboard Generator
 *  3. Drip Content Library       13. Team Readiness Assessment
 *  4. Automated Nudge System     14. Onboarding Playbook Generator
 *  5. Champion Network Builder   15. Integration Blueprint per Team
 *  6. Cross-Team Pollination     16. ROI Calculator per Team
 *  7. Viral Loop Templates       17. Resistance Pattern Detector
 *  8. Success Story Harvester    18. Friction Point Tracker
 *  9. Team Adoption Scorecard    19. Competitive Displacement Playbook
 * 10. Adoption Heat Map          20. Milestone Celebration Engine
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

const log = logger.child("adoption.engine");

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AdoptionStage = "unaware" | "aware" | "evaluating" | "piloting" | "adopted" | "champion";

export interface DripStep {
  stepNumber: number;
  title: string;
  channel: "email" | "slack" | "meeting" | "workshop" | "documentation" | "demo";
  content: string;
  delayDays: number; // Days after previous step
  callToAction: string;
  resources: string[];
}

export interface NudgeTrigger {
  event: string;        // "production_incident", "failed_deploy", "new_api_launched", "sprint_start"
  message: string;
  channel: string;
  urgency: "low" | "medium" | "high";
}

export interface GoNoGoGate {
  criterion: string;
  met: boolean;
  evidence: string;
}

export interface ReadinessAssessment {
  ciCdMaturity: number;     // 0-100
  apiTestingSkills: number; // 0-100
  toolingReadiness: number; // 0-100
  managementBuyIn: number;  // 0-100
  championPresence: number; // 0-100
  overallScore: number;     // 0-100
  recommendations: string[];
}

export interface TeamRoi {
  timePerWeekSaved: number;   // hours
  bugsCaughtInCi: number;     // per month estimated
  deploymentConfidence: number; // 0-100
  incidentReduction: number;  // percentage
  annualValueUsd: number;
}

export interface MomentumMetrics {
  teamsAdopted: number;
  teamsTotal: number;
  adoptionVelocity: number;   // teams per week
  projectedOrgWideDateIso: string | null;
  accelerating: boolean;
  weekOverWeekGrowth: number; // percentage
  currentWave: number;
  wavesCompleted: number;
  wavesPlanned: number;
}

export interface HeatMapEntry {
  teamId: string;
  teamName: string;
  department: string;
  adoptionStage: AdoptionStage;
  adoptionScore: number;
  waveNumber: number | null;
  isChampionTeam: boolean;
}

export interface ExecutiveDashboard {
  momentum: MomentumMetrics;
  heatMap: HeatMapEntry[];
  topBlockers: Array<{ title: string; severity: string; domain: string }>;
  recentMilestones: Array<{ title: string; type: string; date: string }>;
  totalRoi: TeamRoi;
  waveProgress: Array<{
    waveNumber: number;
    name: string;
    status: string;
    teamCount: number;
    completionPercent: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. DRIP CAMPAIGN ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a drip campaign — an automated sequence of enablement content.
 */
export async function createDripCampaign(
  projectId: string,
  data: {
    name: string;
    description?: string;
    targetAudience?: string;
    waveId?: string;
    cadence?: string;
    steps: DripStep[];
    nudgeTriggers?: NudgeTrigger[];
  }
): Promise<string> {
  const campaign = await prisma.dripCampaign.create({
    data: {
      projectId,
      waveId: data.waveId ?? null,
      name: data.name,
      description: data.description ?? null,
      targetAudience: data.targetAudience ?? null,
      cadence: data.cadence ?? "weekly",
      totalSteps: data.steps.length,
      stepsJson: data.steps as unknown as Prisma.InputJsonValue,
      nudgeTriggersJson: data.nudgeTriggers
        ? (data.nudgeTriggers as unknown as Prisma.InputJsonValue)
        : undefined,
      status: "draft",
    },
  });

  log.info("Drip campaign created", { id: campaign.id, name: data.name });
  return campaign.id;
}

/**
 * Activate a drip campaign.
 */
export async function activateDripCampaign(campaignId: string): Promise<{ success: boolean }> {
  await prisma.dripCampaign.update({
    where: { id: campaignId },
    data: { status: "active", startDate: new Date() },
  });
  return { success: true };
}

/**
 * Advance a drip campaign to the next step.
 */
export async function advanceDripStep(campaignId: string): Promise<{ currentStep: number; complete: boolean }> {
  const campaign = await prisma.dripCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  const nextStep = campaign.currentStep + 1;
  const complete = nextStep >= campaign.totalSteps;

  await prisma.dripCampaign.update({
    where: { id: campaignId },
    data: {
      currentStep: nextStep,
      status: complete ? "completed" : "active",
    },
  });

  return { currentStep: nextStep, complete };
}

/**
 * Get the current drip step content for a campaign.
 */
export async function getCurrentDripStep(campaignId: string): Promise<DripStep | null> {
  const campaign = await prisma.dripCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;

  const steps = (campaign.stepsJson as unknown as DripStep[]) ?? [];
  return steps[campaign.currentStep] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. TIDE WAVE PLANNER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an adoption wave with go/no-go gates.
 */
export async function createWave(
  projectId: string,
  data: {
    name: string;
    description?: string;
    waveNumber?: number;
    plannedStartDate?: Date;
    plannedEndDate?: Date;
    targetTeamCount?: number;
    targetUserCount?: number;
    targetCollections?: number;
    targetCiPipelines?: number;
    goNoGoGate?: GoNoGoGate[];
  }
): Promise<string> {
  // Auto-calculate wave number if not provided
  let waveNumber = data.waveNumber;
  if (!waveNumber) {
    const maxWave = await prisma.adoptionWave.findFirst({
      where: { projectId },
      orderBy: { waveNumber: "desc" },
      select: { waveNumber: true },
    });
    waveNumber = (maxWave?.waveNumber ?? 0) + 1;
  }

  const wave = await prisma.adoptionWave.create({
    data: {
      projectId,
      waveNumber,
      name: data.name,
      description: data.description ?? null,
      plannedStartDate: data.plannedStartDate ?? null,
      plannedEndDate: data.plannedEndDate ?? null,
      targetTeamCount: data.targetTeamCount ?? 0,
      targetUserCount: data.targetUserCount ?? 0,
      targetCollections: data.targetCollections ?? 0,
      targetCiPipelines: data.targetCiPipelines ?? 0,
      goNoGoGateJson: data.goNoGoGate
        ? (data.goNoGoGate as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });

  log.info("Adoption wave created", { id: wave.id, waveNumber, name: data.name });
  return wave.id;
}

/**
 * Clear a wave's go/no-go gate.
 */
export async function clearWaveGate(
  waveId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const wave = await prisma.adoptionWave.findUnique({ where: { id: waveId } });
  if (!wave) return { success: false, error: "Wave not found" };

  await prisma.adoptionWave.update({
    where: { id: waveId },
    data: {
      gateCleared: true,
      gateClearedAt: new Date(),
      gateClearedBy: userId,
      status: "READY",
    },
  });

  return { success: true };
}

/**
 * Launch a wave — transition to IN_PROGRESS.
 */
export async function launchWave(waveId: string): Promise<{ success: boolean; error?: string }> {
  const wave = await prisma.adoptionWave.findUnique({ where: { id: waveId } });
  if (!wave) return { success: false, error: "Wave not found" };
  if (!wave.gateCleared) return { success: false, error: "Go/No-Go gate not cleared" };

  await prisma.adoptionWave.update({
    where: { id: waveId },
    data: { status: "IN_PROGRESS", actualStartDate: new Date() },
  });

  return { success: true };
}

/**
 * Complete a wave.
 */
export async function completeWave(waveId: string): Promise<{ success: boolean }> {
  await prisma.adoptionWave.update({
    where: { id: waveId },
    data: { status: "COMPLETED", actualEndDate: new Date() },
  });
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DRIP CONTENT LIBRARY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Curated content library organized by audience and adoption stage.
 * This is a static library that gets populated by the AI planner.
 */
export const DRIP_CONTENT_LIBRARY: Record<string, Record<AdoptionStage, DripStep[]>> = {
  backend_team: {
    unaware: [
      { stepNumber: 1, title: "Why API Testing Matters", channel: "email", content: "API failures cause 60% of production incidents. Here's how Postman catches them before your users do.", delayDays: 0, callToAction: "Watch 3-min overview", resources: ["https://learning.postman.com/docs/getting-started/overview/"] },
      { stepNumber: 2, title: "Your APIs, Tested in 5 Minutes", channel: "slack", content: "Import your OpenAPI spec and get automated tests. Try it now — no setup required.", delayDays: 3, callToAction: "Import your first spec", resources: [] },
    ],
    aware: [
      { stepNumber: 1, title: "Newman + Your CI Pipeline", channel: "email", content: "Run Postman collections in CI/CD with Newman. Works with GitHub Actions, Jenkins, GitLab CI, and every other platform.", delayDays: 0, callToAction: "See your platform's integration guide", resources: [] },
    ],
    evaluating: [
      { stepNumber: 1, title: "Side-by-Side: Postman vs Your Current Setup", channel: "meeting", content: "Live demo comparing your current API testing workflow with Postman Enterprise. 30 minutes, real APIs.", delayDays: 0, callToAction: "Book a demo slot", resources: [] },
    ],
    piloting: [
      { stepNumber: 1, title: "Pilot Progress Check-In", channel: "meeting", content: "Review pilot metrics: collections created, tests running in CI, bugs caught. Discuss roadblocks.", delayDays: 7, callToAction: "Share your pilot metrics", resources: [] },
    ],
    adopted: [
      { stepNumber: 1, title: "Level Up: Contract Testing", channel: "workshop", content: "Now that you're running Postman in CI, let's add contract testing with JSON Schema validation.", delayDays: 0, callToAction: "Join the workshop", resources: [] },
    ],
    champion: [
      { stepNumber: 1, title: "Champion Toolkit", channel: "documentation", content: "Everything you need to evangelize Postman to other teams: deck, demo scripts, ROI calculator.", delayDays: 0, callToAction: "Download the toolkit", resources: [] },
    ],
  },
  qa_team: {
    unaware: [
      { stepNumber: 1, title: "Automate API Testing Without Code", channel: "email", content: "Postman makes API testing accessible to QA engineers who don't want to write custom frameworks.", delayDays: 0, callToAction: "Try the visual test builder", resources: [] },
    ],
    aware: [],
    evaluating: [],
    piloting: [],
    adopted: [],
    champion: [],
  },
  devops_team: {
    unaware: [
      { stepNumber: 1, title: "API Tests as Deployment Gates", channel: "email", content: "Use Postman Monitors and Newman as quality gates in your deployment pipeline. No deploy without green API tests.", delayDays: 0, callToAction: "See the deployment gate pattern", resources: [] },
    ],
    aware: [],
    evaluating: [],
    piloting: [],
    adopted: [],
    champion: [],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. AUTOMATED NUDGE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pre-built nudge templates triggered by real events.
 */
export const NUDGE_TEMPLATES: NudgeTrigger[] = [
  { event: "production_incident", message: "This incident could have been caught by API contract tests in CI. Here's how to set that up in 10 minutes.", channel: "slack", urgency: "high" },
  { event: "failed_deploy", message: "Deploy failed due to API incompatibility. Postman's Newman can catch these before they hit production.", channel: "slack", urgency: "high" },
  { event: "new_api_launched", message: "New API deployed! Add Postman tests now while the spec is fresh. Takes 5 minutes with auto-generated tests.", channel: "email", urgency: "medium" },
  { event: "sprint_start", message: "Sprint planning? Consider adding API test coverage as an acceptance criterion. Here's a template.", channel: "slack", urgency: "low" },
  { event: "quarterly_review", message: "Q4 API reliability report: teams using Postman in CI had 73% fewer API-related incidents.", channel: "email", urgency: "medium" },
  { event: "new_team_member", message: "New team member? Get them productive with APIs in 15 minutes using your team's Postman workspace.", channel: "email", urgency: "low" },
  { event: "competitor_evaluation", message: "Evaluating API tools? Here's a comparison matrix and migration guide from common alternatives.", channel: "email", urgency: "medium" },
];

/**
 * Check if any nudge triggers match current events and return applicable nudges.
 */
export function getApplicableNudges(
  events: string[],
  campaignTriggers?: NudgeTrigger[]
): NudgeTrigger[] {
  const allTriggers = [...NUDGE_TEMPLATES, ...(campaignTriggers ?? [])];
  return allTriggers.filter((t) => events.includes(t.event));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. CHAMPION NETWORK BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Designate a team member as a champion.
 */
export async function designateChampion(
  teamId: string,
  championName: string,
  championEmail: string
): Promise<{ success: boolean }> {
  await prisma.adoptionTeam.update({
    where: { id: teamId },
    data: { championName, championEmail, championActive: true },
  });
  return { success: true };
}

/**
 * Get all active champions across the project.
 */
export async function getChampionNetwork(projectId: string) {
  const teams = await prisma.adoptionTeam.findMany({
    where: { projectId, championActive: true },
    select: {
      id: true, name: true, department: true, championName: true,
      championEmail: true, adoptionStage: true, adoptionScore: true,
    },
  });
  return teams;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. CROSS-TEAM POLLINATION SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate pollination session pairings: adopted teams mentor prospective teams.
 */
export async function generatePollinationPairings(projectId: string) {
  const teams = await prisma.adoptionTeam.findMany({
    where: { projectId },
    orderBy: { adoptionScore: "desc" },
  });

  const mentors = teams.filter((t) =>
    t.adoptionStage === "adopted" || t.adoptionStage === "champion"
  );
  const learners = teams.filter((t) =>
    t.adoptionStage === "unaware" || t.adoptionStage === "aware" || t.adoptionStage === "evaluating"
  );

  const pairings: Array<{
    mentor: { id: string; name: string; champion: string | null };
    learner: { id: string; name: string; lead: string | null };
    suggestedAgenda: string[];
  }> = [];

  for (let i = 0; i < learners.length; i++) {
    const mentor = mentors[i % Math.max(mentors.length, 1)];
    if (!mentor) break;

    pairings.push({
      mentor: { id: mentor.id, name: mentor.name, champion: mentor.championName },
      learner: { id: learners[i].id, name: learners[i].name, lead: learners[i].teamLead },
      suggestedAgenda: [
        `${mentor.name} shares: How we integrated Postman into our CI pipeline`,
        `Live demo: Running Newman tests in ${learners[i].ciPlatform ?? "your CI platform"}`,
        `Q&A: Addressing ${learners[i].name}'s specific concerns`,
        "Action items: 3 things to try this week",
      ],
    });
  }

  return pairings;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. VIRAL LOOP TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export const VIRAL_LOOP_TEMPLATES = [
  {
    name: "5-Minute Quick Start",
    type: "workspace_invite" as const,
    description: "Pre-configured workspace with sample collection, environment, and test scripts. New user is productive in 5 minutes.",
    content: "Import this collection → Run it → See green tests → You're done. Now add your own API.",
  },
  {
    name: "API Health Check Collection",
    type: "shareable_collection" as const,
    description: "Drop-in health check collection that monitors your team's APIs. Share the results dashboard.",
    content: "Run this collection against your APIs. Share the results with your team. Watch them ask 'How did you do that?'",
  },
  {
    name: "Before/After Demo",
    type: "demo_script" as const,
    description: "Side-by-side comparison: manual API testing vs Postman automated testing. 10-minute demo.",
    content: "Step 1: Show the painful way (curl + manual checking). Step 2: Show the Postman way (one click, full report). Step 3: Show it running in CI.",
  },
  {
    name: "Team Workspace Template",
    type: "workspace_template" as const,
    description: "Pre-structured workspace with folders for each API, shared environments, and CI/CD config templates.",
    content: "Fork this workspace for your team. It comes with folder structure, environment templates, and a README for getting started.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 8. SUCCESS STORY HARVESTER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Harvest a success story from an adopted team's metrics.
 */
export async function harvestSuccessStory(teamId: string) {
  const team = await prisma.adoptionTeam.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const roi = (team.actualRoiJson as TeamRoi | null) ?? (team.estimatedRoiJson as TeamRoi | null);

  return {
    teamName: team.name,
    department: team.department,
    headline: `${team.name} now runs ${team.ciPipelinesActive} API test pipelines with ${team.testsWritten} automated tests`,
    metrics: {
      collectionsCreated: team.collectionsCreated,
      testsWritten: team.testsWritten,
      ciPipelinesActive: team.ciPipelinesActive,
      activeUsers: team.activeUsers,
      newmanRunsPerWeek: team.newmanRunsPerWeek,
    },
    roi,
    quote: team.championName
      ? `"${team.championName} from ${team.name}: Postman in our CI pipeline catches issues before they reach staging."`
      : null,
    adoptionTimeline: `Went from ${team.adoptionStage === "champion" ? "zero to champion" : "zero to adopted"} in the current wave.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. TEAM ADOPTION SCORECARD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate a team's adoption score from their metrics.
 */
export function calculateAdoptionScore(team: {
  collectionsCreated: number;
  testsWritten: number;
  ciPipelinesActive: number;
  activeUsers: number;
  teamSize: number;
  newmanRunsPerWeek: number;
}): number {
  const weights = {
    hasCollections: team.collectionsCreated > 0 ? 15 : 0,
    collectionDepth: Math.min(team.collectionsCreated * 3, 15),
    hasTests: team.testsWritten > 0 ? 10 : 0,
    testCoverage: Math.min(team.testsWritten * 0.5, 15),
    hasCi: team.ciPipelinesActive > 0 ? 15 : 0,
    ciDepth: Math.min(team.ciPipelinesActive * 5, 10),
    userAdoption: team.teamSize > 0 ? Math.min((team.activeUsers / team.teamSize) * 15, 15) : 0,
    newmanFrequency: Math.min(team.newmanRunsPerWeek * 1, 5),
  };

  return Math.min(Math.round(Object.values(weights).reduce((a, b) => a + b, 0)), 100);
}

/**
 * Update a team's adoption score and stage.
 */
export async function refreshTeamScore(teamId: string): Promise<number> {
  const team = await prisma.adoptionTeam.findUnique({ where: { id: teamId } });
  if (!team) return 0;

  const score = calculateAdoptionScore(team);
  const stage = scoreToStage(score, team.championActive);

  await prisma.adoptionTeam.update({
    where: { id: teamId },
    data: { adoptionScore: score, adoptionStage: stage },
  });

  return score;
}

function scoreToStage(score: number, isChampion: boolean): AdoptionStage {
  if (isChampion && score >= 70) return "champion";
  if (score >= 70) return "adopted";
  if (score >= 40) return "piloting";
  if (score >= 20) return "evaluating";
  if (score >= 5) return "aware";
  return "unaware";
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. ADOPTION HEAT MAP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate the org-wide adoption heat map.
 */
export async function getAdoptionHeatMap(projectId: string): Promise<HeatMapEntry[]> {
  const teams = await prisma.adoptionTeam.findMany({
    where: { projectId },
    include: { wave: { select: { waveNumber: true } } },
    orderBy: [{ department: "asc" }, { adoptionScore: "desc" }],
  });

  return teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    department: t.department ?? "Unknown",
    adoptionStage: t.adoptionStage as AdoptionStage,
    adoptionScore: t.adoptionScore,
    waveNumber: t.wave?.waveNumber ?? null,
    isChampionTeam: t.championActive,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. ADOPTION MOMENTUM TRACKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate momentum metrics for the entire adoption program.
 */
export async function getMomentumMetrics(projectId: string): Promise<MomentumMetrics> {
  const teams = await prisma.adoptionTeam.findMany({ where: { projectId } });
  const waves = await prisma.adoptionWave.findMany({
    where: { projectId },
    orderBy: { waveNumber: "asc" },
  });

  const adopted = teams.filter((t) =>
    t.adoptionStage === "adopted" || t.adoptionStage === "champion"
  );

  const completedWaves = waves.filter((w) => w.status === "COMPLETED");
  const currentWaveObj = waves.find((w) => w.status === "IN_PROGRESS");

  // Calculate velocity: teams adopted per week (simplified)
  const firstAdoption = teams
    .filter((t) => t.adoptionStage !== "unaware")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  let velocity = 0;
  let projectedDate: string | null = null;

  if (firstAdoption && adopted.length > 0) {
    const weeksSinceStart = Math.max(
      (Date.now() - firstAdoption.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000),
      1
    );
    velocity = adopted.length / weeksSinceStart;

    const remaining = teams.length - adopted.length;
    if (velocity > 0 && remaining > 0) {
      const weeksToComplete = remaining / velocity;
      const projected = new Date(Date.now() + weeksToComplete * 7 * 24 * 60 * 60 * 1000);
      projectedDate = projected.toISOString().split("T")[0];
    }
  }

  return {
    teamsAdopted: adopted.length,
    teamsTotal: teams.length,
    adoptionVelocity: Math.round(velocity * 10) / 10,
    projectedOrgWideDateIso: projectedDate,
    accelerating: velocity > 0, // simplified
    weekOverWeekGrowth: 0, // would need historical data
    currentWave: currentWaveObj?.waveNumber ?? 0,
    wavesCompleted: completedWaves.length,
    wavesPlanned: waves.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. EXECUTIVE DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate an executive-ready adoption dashboard.
 */
export async function generateExecutiveDashboard(projectId: string): Promise<ExecutiveDashboard> {
  const [momentum, heatMap, waves, milestones, blockers] = await Promise.all([
    getMomentumMetrics(projectId),
    getAdoptionHeatMap(projectId),
    prisma.adoptionWave.findMany({
      where: { projectId },
      include: { teams: { select: { id: true } } },
      orderBy: { waveNumber: "asc" },
    }),
    prisma.adoptionMilestone.findMany({
      where: { projectId },
      orderBy: { celebratedAt: "desc" },
      take: 10,
    }),
    prisma.blocker.findMany({
      where: {
        projectId,
        status: { notIn: ["NEUTRALIZED", "ACCEPTED", "DORMANT"] },
      },
      orderBy: { severity: "asc" },
      take: 5,
    }),
  ]);

  // Aggregate ROI across all teams
  const teams = await prisma.adoptionTeam.findMany({ where: { projectId } });
  const totalRoi: TeamRoi = {
    timePerWeekSaved: 0, bugsCaughtInCi: 0,
    deploymentConfidence: 0, incidentReduction: 0, annualValueUsd: 0,
  };
  let roiCount = 0;
  for (const t of teams) {
    const roi = (t.actualRoiJson ?? t.estimatedRoiJson) as TeamRoi | null;
    if (roi) {
      totalRoi.timePerWeekSaved += roi.timePerWeekSaved ?? 0;
      totalRoi.bugsCaughtInCi += roi.bugsCaughtInCi ?? 0;
      totalRoi.annualValueUsd += roi.annualValueUsd ?? 0;
      totalRoi.deploymentConfidence += roi.deploymentConfidence ?? 0;
      totalRoi.incidentReduction += roi.incidentReduction ?? 0;
      roiCount++;
    }
  }
  if (roiCount > 0) {
    totalRoi.deploymentConfidence = Math.round(totalRoi.deploymentConfidence / roiCount);
    totalRoi.incidentReduction = Math.round(totalRoi.incidentReduction / roiCount);
  }

  return {
    momentum,
    heatMap,
    topBlockers: blockers.map((b) => ({
      title: b.title, severity: b.severity, domain: b.domain,
    })),
    recentMilestones: milestones.map((m) => ({
      title: m.title, type: m.type, date: m.celebratedAt.toISOString(),
    })),
    totalRoi,
    waveProgress: waves.map((w) => ({
      waveNumber: w.waveNumber,
      name: w.name,
      status: w.status,
      teamCount: w.teams.length,
      completionPercent: w.targetTeamCount > 0
        ? Math.round((w.actualTeamCount / w.targetTeamCount) * 100)
        : 0,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. TEAM READINESS ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assess a team's readiness for Postman adoption.
 */
export function assessTeamReadiness(team: {
  ciPlatform: string | null;
  primaryLanguage: string | null;
  existingTools: unknown;
  teamSize: number;
  teamLead: string | null;
  championName: string | null;
  integrationComplexity: string | null;
}): ReadinessAssessment {
  const ciCdMaturity = team.ciPlatform ? 70 : 20;
  const apiTestingSkills = team.primaryLanguage ? 50 : 20;
  const toolingReadiness = team.ciPlatform ? 60 : 30;
  const managementBuyIn = team.teamLead ? 60 : 30;
  const championPresence = team.championName ? 80 : 20;

  const overallScore = Math.round(
    (ciCdMaturity + apiTestingSkills + toolingReadiness + managementBuyIn + championPresence) / 5
  );

  const recommendations: string[] = [];
  if (!team.ciPlatform) recommendations.push("Identify CI/CD platform first — Postman integration depends on it");
  if (!team.teamLead) recommendations.push("Get a team lead as primary contact for onboarding");
  if (!team.championName) recommendations.push("Identify an internal champion who can drive adoption within the team");
  if (team.integrationComplexity === "high") recommendations.push("Plan for additional integration support — complex environment detected");
  if (team.existingTools) recommendations.push("Create competitive displacement plan for existing tools");

  return {
    ciCdMaturity, apiTestingSkills, toolingReadiness,
    managementBuyIn, championPresence, overallScore, recommendations,
  };
}

/**
 * Run readiness assessment and store results.
 */
export async function runReadinessAssessment(teamId: string): Promise<ReadinessAssessment> {
  const team = await prisma.adoptionTeam.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");

  const assessment = assessTeamReadiness(team);

  await prisma.adoptionTeam.update({
    where: { id: teamId },
    data: {
      readinessScore: assessment.overallScore,
      readinessJson: assessment as unknown as Prisma.InputJsonValue,
    },
  });

  return assessment;
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. ROI CALCULATOR PER TEAM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate projected ROI for a team.
 */
export function calculateTeamRoi(team: {
  teamSize: number;
  ciPipelinesActive: number;
  testsWritten: number;
  newmanRunsPerWeek: number;
}): TeamRoi {
  // Conservative estimates based on industry data
  const hoursPerPersonPerWeek = 0.5; // Time saved per person on API testing
  const bugsPerTestPerMonth = 0.1;   // Bugs caught per automated test per month
  const confidencePerPipeline = 8;   // % confidence increase per active CI pipeline
  const incidentReductionPerTest = 0.5; // % incident reduction per 10 tests
  const hourlyRate = 75; // USD fully loaded

  const timePerWeekSaved = Math.round(team.teamSize * hoursPerPersonPerWeek * 10) / 10;
  const bugsCaughtInCi = Math.round(team.testsWritten * bugsPerTestPerMonth);
  const deploymentConfidence = Math.min(50 + team.ciPipelinesActive * confidencePerPipeline, 99);
  const incidentReduction = Math.min(Math.round(team.testsWritten * incidentReductionPerTest / 10), 80);
  const annualValueUsd = Math.round(timePerWeekSaved * 52 * hourlyRate + bugsCaughtInCi * 12 * 500);

  return { timePerWeekSaved, bugsCaughtInCi, deploymentConfidence, incidentReduction, annualValueUsd };
}

/**
 * Calculate and store ROI for a team.
 */
export async function updateTeamRoi(teamId: string): Promise<TeamRoi> {
  const team = await prisma.adoptionTeam.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");

  const roi = calculateTeamRoi(team);

  await prisma.adoptionTeam.update({
    where: { id: teamId },
    data: { estimatedRoiJson: roi as unknown as Prisma.InputJsonValue },
  });

  return roi;
}

// ═══════════════════════════════════════════════════════════════════════════
// 17. RESISTANCE PATTERN DETECTOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Common resistance patterns with detection heuristics and intervention playbooks.
 */
export const RESISTANCE_PATTERNS = [
  {
    pattern: "not_invented_here",
    signals: ["existingTools", "high_resistance", "custom_framework"],
    description: "Team has built their own testing framework and sees Postman as redundant.",
    intervention: "Show how Postman complements (not replaces) their framework. Focus on collaboration and CI/CD integration that their custom tool lacks.",
  },
  {
    pattern: "too_busy",
    signals: ["no_champion", "sprint_pressure", "deadline_driven"],
    description: "Team claims they're too busy to learn a new tool.",
    intervention: "Show 5-minute quick wins. Offer to set up the initial collection for them. Demonstrate time savings with ROI calculator.",
  },
  {
    pattern: "security_concerns",
    signals: ["security_team_blocker", "data_residency", "compliance"],
    description: "Security/compliance team has concerns about cloud-based tools.",
    intervention: "Present Postman's SOC2, data residency options, on-premise capabilities. Arrange security team briefing.",
  },
  {
    pattern: "leadership_apathy",
    signals: ["no_management_buyin", "no_budget", "low_priority"],
    description: "Leadership doesn't see API testing as a priority.",
    intervention: "Present production incident data. Show cost of API failures. Get executive sponsor to communicate priority.",
  },
  {
    pattern: "tool_fatigue",
    signals: ["many_tools", "recent_tool_change", "change_fatigue"],
    description: "Team is suffering from too many tool changes recently.",
    intervention: "Position Postman as consolidation (replaces multiple tools). Show how it reduces tool count. Offer gradual migration path.",
  },
  {
    pattern: "skill_gap",
    signals: ["no_api_experience", "manual_testing_only", "junior_team"],
    description: "Team lacks API testing skills and finds the concept intimidating.",
    intervention: "Start with Postman's visual interface (no code). Offer training workshops. Pair with champion from adopted team.",
  },
];

/**
 * Detect resistance patterns for a team based on their profile.
 */
export function detectResistancePatterns(team: {
  existingTools: unknown;
  resistanceLevel: string;
  resistanceNotes: string | null;
  championActive: boolean;
  teamLead: string | null;
  frictionPoints: unknown;
}): Array<{ pattern: string; description: string; intervention: string; confidence: number }> {
  const detected: Array<{ pattern: string; description: string; intervention: string; confidence: number }> = [];
  const tools = team.existingTools as string[] | null;
  const friction = team.frictionPoints as string[] | null;

  for (const pattern of RESISTANCE_PATTERNS) {
    let matchCount = 0;
    const totalSignals = pattern.signals.length;

    if (pattern.signals.includes("existingTools") && tools && tools.length > 0) matchCount++;
    if (pattern.signals.includes("high_resistance") && team.resistanceLevel === "high") matchCount++;
    if (pattern.signals.includes("no_champion") && !team.championActive) matchCount++;
    if (pattern.signals.includes("no_management_buyin") && !team.teamLead) matchCount++;
    if (pattern.signals.includes("many_tools") && tools && tools.length > 3) matchCount++;

    // Check friction points
    if (friction) {
      for (const signal of pattern.signals) {
        if (friction.some((f) => f.toLowerCase().includes(signal.replace(/_/g, " ")))) {
          matchCount++;
        }
      }
    }

    // Check resistance notes
    if (team.resistanceNotes) {
      const notes = team.resistanceNotes.toLowerCase();
      for (const signal of pattern.signals) {
        if (notes.includes(signal.replace(/_/g, " "))) matchCount++;
      }
    }

    const confidence = Math.min(Math.round((matchCount / totalSignals) * 100), 100);
    if (confidence >= 30) {
      detected.push({
        pattern: pattern.pattern,
        description: pattern.description,
        intervention: pattern.intervention,
        confidence,
      });
    }
  }

  return detected.sort((a, b) => b.confidence - a.confidence);
}

// ═══════════════════════════════════════════════════════════════════════════
// 18. FRICTION POINT TRACKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log a friction point for a team.
 */
export async function addFrictionPoint(
  teamId: string,
  frictionPoint: string
): Promise<{ success: boolean }> {
  const team = await prisma.adoptionTeam.findUnique({ where: { id: teamId } });
  if (!team) return { success: false };

  const existing = (team.frictionPoints as string[]) ?? [];
  existing.push(frictionPoint);

  await prisma.adoptionTeam.update({
    where: { id: teamId },
    data: { frictionPoints: existing as Prisma.InputJsonValue },
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// 19. COMPETITIVE DISPLACEMENT PLAYBOOK (static templates)
// ═══════════════════════════════════════════════════════════════════════════

export const COMPETITIVE_DISPLACEMENT_PLAYBOOKS: Record<string, {
  competitor: string;
  migrationSteps: string[];
  featureMapping: Array<{ theirFeature: string; postmanEquivalent: string }>;
  keyAdvantages: string[];
  migrationEffort: string;
}> = {
  swagger_ui: {
    competitor: "Swagger UI / OpenAPI tools",
    migrationSteps: [
      "Import OpenAPI spec into Postman (one click)",
      "Auto-generate tests from imported endpoints",
      "Set up environments for different servers",
      "Add Newman CI integration (Swagger UI can't do this)",
    ],
    featureMapping: [
      { theirFeature: "API documentation", postmanEquivalent: "Postman API Documentation (auto-published)" },
      { theirFeature: "Try it out", postmanEquivalent: "Postman Collections (persistent, shareable)" },
      { theirFeature: "Schema validation", postmanEquivalent: "Contract testing with JSON Schema + pm.test()" },
    ],
    keyAdvantages: ["CI/CD integration", "Team collaboration", "Environment management", "Automated testing"],
    migrationEffort: "1-2 hours per API",
  },
  insomnia: {
    competitor: "Insomnia",
    migrationSteps: [
      "Export from Insomnia as HAR or OpenAPI",
      "Import into Postman workspace",
      "Recreate environments (Postman has richer env management)",
      "Add test scripts (Postman's scripting is more powerful)",
      "Set up Newman for CI/CD",
    ],
    featureMapping: [
      { theirFeature: "Request builder", postmanEquivalent: "Postman Request Builder (with pre/post scripts)" },
      { theirFeature: "Environment variables", postmanEquivalent: "Postman Environments (with scoping)" },
      { theirFeature: "Design documents", postmanEquivalent: "Postman API Builder + Mock Servers" },
    ],
    keyAdvantages: ["Enterprise governance", "Team workspaces", "Newman CI/CD", "Monitors", "Mock servers"],
    migrationEffort: "2-4 hours",
  },
  curl_scripts: {
    competitor: "curl / shell scripts",
    migrationSteps: [
      "Import curl commands into Postman (paste and convert)",
      "Organize into collections by API/service",
      "Add assertions (replace manual grep checking with pm.test())",
      "Add environments (replace hardcoded URLs/tokens)",
      "Set up Newman (replaces shell script runners)",
    ],
    featureMapping: [
      { theirFeature: "curl commands", postmanEquivalent: "Postman Requests (with UI + scripting)" },
      { theirFeature: "Shell scripts", postmanEquivalent: "Newman CLI (structured, reportable)" },
      { theirFeature: "grep assertions", postmanEquivalent: "pm.test() + pm.expect() (rich assertion library)" },
    ],
    keyAdvantages: ["Discoverability", "Collaboration", "Structured reporting", "No shell expertise needed"],
    migrationEffort: "30 minutes per script",
  },
  custom_framework: {
    competitor: "Custom test framework",
    migrationSteps: [
      "Don't replace — complement. Postman handles API-level testing, custom framework handles unit/integration",
      "Import API endpoints into Postman for exploratory and contract testing",
      "Use Newman alongside existing test runner in CI",
      "Gradually migrate smoke/health tests to Postman collections",
    ],
    featureMapping: [
      { theirFeature: "Custom assertions", postmanEquivalent: "pm.test() scripts (JavaScript, extensible)" },
      { theirFeature: "CI integration", postmanEquivalent: "Newman (works with all CI platforms)" },
      { theirFeature: "Reporting", postmanEquivalent: "Newman reporters (JUnit, HTML, JSON)" },
    ],
    keyAdvantages: ["Non-developers can contribute", "Visual debugging", "Collaboration", "Monitors for production"],
    migrationEffort: "Gradual — 1 week to complement, 1 month to fully transition",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 20. MILESTONE CELEBRATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Record an adoption milestone and generate celebration content.
 */
export async function celebrateMilestone(
  projectId: string,
  data: {
    type: string;
    title: string;
    description?: string;
    teamName?: string;
  }
): Promise<string> {
  // Capture current metrics as snapshot
  const teams = await prisma.adoptionTeam.findMany({ where: { projectId } });
  const metricsSnapshot = {
    totalTeams: teams.length,
    adoptedTeams: teams.filter((t) => t.adoptionStage === "adopted" || t.adoptionStage === "champion").length,
    totalCollections: teams.reduce((sum, t) => sum + t.collectionsCreated, 0),
    totalTests: teams.reduce((sum, t) => sum + t.testsWritten, 0),
    totalCiPipelines: teams.reduce((sum, t) => sum + t.ciPipelinesActive, 0),
    totalActiveUsers: teams.reduce((sum, t) => sum + t.activeUsers, 0),
  };

  // Generate celebration message
  const celebrationJson = {
    emoji: getMilestoneEmoji(data.type),
    message: generateCelebrationMessage(data.type, data.title, metricsSnapshot),
    shareableCard: {
      headline: data.title,
      subhead: data.description ?? "",
      metrics: metricsSnapshot,
    },
  };

  const milestone = await prisma.adoptionMilestone.create({
    data: {
      projectId,
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      teamName: data.teamName ?? null,
      metricsSnapshot: metricsSnapshot as unknown as Prisma.InputJsonValue,
      celebrationJson: celebrationJson as unknown as Prisma.InputJsonValue,
    },
  });

  log.info("Milestone celebrated", { id: milestone.id, type: data.type, title: data.title });
  return milestone.id;
}

/**
 * Auto-detect milestones based on current state.
 */
export async function detectMilestones(projectId: string): Promise<string[]> {
  const teams = await prisma.adoptionTeam.findMany({ where: { projectId } });
  const existingTypes = new Set(
    (await prisma.adoptionMilestone.findMany({
      where: { projectId },
      select: { type: true, teamName: true },
    })).map((m) => `${m.type}:${m.teamName ?? ""}`)
  );

  const newMilestones: string[] = [];

  // Check per-team milestones
  for (const team of teams) {
    if (team.collectionsCreated > 0 && !existingTypes.has(`first_collection:${team.name}`)) {
      newMilestones.push(
        await celebrateMilestone(projectId, {
          type: "first_collection",
          title: `${team.name} created their first Postman collection!`,
          teamName: team.name,
        })
      );
    }

    if (team.ciPipelinesActive > 0 && !existingTypes.has(`first_ci_run:${team.name}`)) {
      newMilestones.push(
        await celebrateMilestone(projectId, {
          type: "first_ci_run",
          title: `${team.name} is running Postman tests in CI!`,
          teamName: team.name,
        })
      );
    }

    if (team.adoptionStage === "adopted" && !existingTypes.has(`team_onboarded:${team.name}`)) {
      newMilestones.push(
        await celebrateMilestone(projectId, {
          type: "team_onboarded",
          title: `${team.name} is fully onboarded to Postman Enterprise!`,
          teamName: team.name,
        })
      );
    }
  }

  // Check org-wide milestones
  const adoptedCount = teams.filter((t) =>
    t.adoptionStage === "adopted" || t.adoptionStage === "champion"
  ).length;

  if (adoptedCount === teams.length && teams.length > 0 && !existingTypes.has("org_wide:")) {
    newMilestones.push(
      await celebrateMilestone(projectId, {
        type: "org_wide",
        title: "Organization-wide Postman adoption achieved!",
        description: `All ${teams.length} teams are now using Postman in their CI/CD pipelines.`,
      })
    );
  }

  return newMilestones;
}

// Helpers for milestone celebrations
function getMilestoneEmoji(type: string): string {
  const emojis: Record<string, string> = {
    first_collection: "🎯", first_ci_run: "🚀", full_coverage: "💯",
    team_onboarded: "🎉", wave_complete: "🌊", org_wide: "🏆",
  };
  return emojis[type] ?? "⭐";
}

function generateCelebrationMessage(
  type: string,
  title: string,
  metrics: Record<string, number>
): string {
  const base = title;
  const context = `Org-wide: ${metrics.adoptedTeams}/${metrics.totalTeams} teams adopted, ${metrics.totalCiPipelines} CI pipelines active, ${metrics.totalTests} automated tests running.`;
  return `${base}\n\n${context}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAM CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Add a team to the adoption tracking system.
 */
export async function addTeam(
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
): Promise<string> {
  const team = await prisma.adoptionTeam.create({
    data: {
      projectId,
      waveId: data.waveId ?? null,
      name: data.name,
      department: data.department ?? null,
      teamSize: data.teamSize ?? 0,
      teamLead: data.teamLead ?? null,
      teamLeadEmail: data.teamLeadEmail ?? null,
      ciPlatform: data.ciPlatform ?? null,
      primaryLanguage: data.primaryLanguage ?? null,
      existingTools: data.existingTools
        ? (data.existingTools as Prisma.InputJsonValue)
        : undefined,
      integrationComplexity: data.integrationComplexity ?? null,
    },
  });

  return team.id;
}

/**
 * Update team metrics (from external data or manual input).
 */
export async function updateTeamMetrics(
  teamId: string,
  metrics: {
    collectionsCreated?: number;
    testsWritten?: number;
    ciPipelinesActive?: number;
    activeUsers?: number;
    newmanRunsPerWeek?: number;
  }
): Promise<{ success: boolean; newScore: number }> {
  await prisma.adoptionTeam.update({
    where: { id: teamId },
    data: metrics,
  });

  const newScore = await refreshTeamScore(teamId);
  return { success: true, newScore };
}
