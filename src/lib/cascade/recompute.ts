/**
 * Recompute Engine
 *
 * Executes recompute tasks for DIRTY phases.
 * Dispatches to the correct AI agent for each implemented phase.
 * Skips phases whose upstream dependencies aren't CLEAN yet.
 * Generates Proposals — never directly writes artifacts.
 */

import { prisma } from "@/lib/prisma";
import { Phase } from "@prisma/client";
import { getPhaseNode, getDependencies, getAllPhasesOrdered } from "./phases";
import { generatePatch, generateDiffSummary } from "./patch";
import type { Prisma } from "@prisma/client";
import { persistPhaseAssumptions, isPhaseGateClear } from "@/lib/assumptions/engine";
import { persistDetectedBlockers } from "@/lib/blockers/engine";
import type { AssumptionItem, BlockerDetection } from "@/lib/ai/agents/topologyTypes";

// Agent imports
import { runDiscoveryPipeline } from "@/lib/ai/orchestrator";
import { runCurrentTopologyBuilder } from "@/lib/ai/agents/currentTopologyBuilder";
import { runFutureStateDesigner } from "@/lib/ai/agents/futureStateDesigner";
import { runSolutionDesigner } from "@/lib/ai/agents/solutionDesigner";
import { runTestDesigner } from "@/lib/ai/agents/testDesigner";
import { runCraftSolution } from "@/lib/ai/agents/craftSolution";
import { runTestSolution } from "@/lib/ai/agents/testSolution";
import { runDeploymentPlanner } from "@/lib/ai/agents/deploymentPlanner";
import { runMonitoringPlanner } from "@/lib/ai/agents/monitoringPlanner";
import { runIterationPlanner } from "@/lib/ai/agents/iterationPlanner";
import { runInfrastructurePlanner } from "@/lib/ai/agents/infrastructurePlanner";

// Markdown generators
import {
  topologyToMarkdown,
  futureStateToMarkdown,
  solutionDesignToMarkdown,
  infrastructureToMarkdown,
  testDesignToMarkdown,
  craftSolutionToMarkdown,
  testSolutionToMarkdown,
  deploymentPlanToMarkdown,
  monitoringToMarkdown,
  iterationToMarkdown,
} from "@/lib/ai/agents/topologyTypes";

/**
 * Execute all tasks in a RecomputeJob.
 * Runs each PENDING task in topological order.
 * Skips phases whose upstream dependencies aren't satisfied.
 *
 * Assumption Verification Integration:
 * - After each agent runs, its assumptions are persisted for human review.
 * - In "gated" mode: pauses at each phase with critical unverified assumptions.
 * - In "eager" mode (default): runs all phases, surfaces all assumptions at once.
 * - Verified/corrected assumptions from prior runs are injected into agent prompts
 *   automatically via the runner's constraint injection.
 */
export async function executeRecomputeJob(
  jobId: string,
  options?: {
    /** If true, pause execution when a phase has unverified High-confidence assumptions */
    gatedMode?: boolean;
  }
): Promise<{
  completedTasks: number;
  proposals: string[];
  errors: string[];
  skipped: string[];
  assumptionIds: string[];
  blockerIds: string[];
  pausedAtPhase?: string;
}> {
  const job = await prisma.recomputeJob.findUnique({
    where: { id: jobId },
    include: { tasks: true, project: true },
  });

  if (!job) throw new Error(`RecomputeJob not found: ${jobId}`);
  if (!job.project) throw new Error(`Project not found for job: ${jobId}`);

  await prisma.recomputeJob.update({
    where: { id: jobId },
    data: { status: "RUNNING" },
  });

  const allPhases = getAllPhasesOrdered();
  const sortedTasks = [...job.tasks].sort((a, b) => {
    return allPhases.indexOf(a.phase) - allPhases.indexOf(b.phase);
  });

  const proposals: string[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];
  const allAssumptionIds: string[] = [];
  const allBlockerIds: string[] = [];
  let completedTasks = 0;
  let pausedAtPhase: string | undefined;

  for (const task of sortedTasks) {
    if (task.status !== "PENDING") continue;

    // -----------------------------------------------------------------------
    // GATED MODE: Check if prior phase has unverified critical assumptions
    // -----------------------------------------------------------------------
    if (options?.gatedMode && completedTasks > 0) {
      const gate = await isPhaseGateClear(job.projectId, task.phase);
      if (!gate.clear) {
        pausedAtPhase = task.phase;
        await prisma.recomputeTask.update({
          where: { id: task.id },
          data: {
            status: "SKIPPED",
            message: `Paused: ${gate.pendingCritical} critical assumption(s) need human verification before this phase can proceed.`,
            finishedAt: new Date(),
          },
        });
        skipped.push(task.phase);

        // Skip all remaining tasks too
        for (const remaining of sortedTasks) {
          if (remaining.status === "PENDING" && remaining.id !== task.id) {
            const rOrder = allPhases.indexOf(remaining.phase);
            const tOrder = allPhases.indexOf(task.phase);
            if (rOrder >= tOrder) {
              await prisma.recomputeTask.update({
                where: { id: remaining.id },
                data: {
                  status: "SKIPPED",
                  message: `Paused: waiting for assumption verification at ${task.phase}`,
                  finishedAt: new Date(),
                },
              });
              skipped.push(remaining.phase);
            }
          }
        }
        break; // Stop processing
      }
    }

    try {
      await prisma.recomputeTask.update({
        where: { id: task.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      const node = getPhaseNode(task.phase);

      if (!node.implemented) {
        const proposalId = await createStalePlaceholder(
          task.id, job.projectId, task.phase, job.snapshotId || "", node.label
        );
        proposals.push(proposalId);
        completedTasks++;
        await prisma.recomputeTask.update({
          where: { id: task.id },
          data: { status: "COMPLETED", finishedAt: new Date() },
        });
        continue;
      }

      // Check upstream dependencies have CLEAN artifacts
      const deps = getDependencies(task.phase);
      const upstreamOk = await checkUpstreamReady(job.projectId, deps);

      if (!upstreamOk && task.phase !== "DISCOVERY") {
        skipped.push(task.phase);
        await prisma.recomputeTask.update({
          where: { id: task.id },
          data: {
            status: "SKIPPED",
            message: `Upstream dependencies not ready: ${deps.join(", ")}`,
            finishedAt: new Date(),
          },
        });
        continue;
      }

      // Execute the agent + persist assumptions + detect blockers
      const { proposalId, assumptionIds, blockerIds } = await executePhaseAgentWithAssumptions(
        task.id, job.projectId, job.project.name, task.phase, job.snapshotId || "", jobId
      );
      proposals.push(proposalId);
      allAssumptionIds.push(...assumptionIds);
      allBlockerIds.push(...blockerIds);
      completedTasks++;

      await prisma.recomputeTask.update({
        where: { id: task.id },
        data: { status: "COMPLETED", finishedAt: new Date() },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${task.phase}: ${msg}`);
      await prisma.recomputeTask.update({
        where: { id: task.id },
        data: { status: "FAILED", message: msg, finishedAt: new Date() },
      });
    }
  }

  const finalStatus = pausedAtPhase
    ? "PAUSED_FOR_VERIFICATION"
    : errors.length > 0
      ? "COMPLETED_WITH_ERRORS"
      : "COMPLETED";

  await prisma.recomputeJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      finishedAt: pausedAtPhase ? undefined : new Date(),
    },
  });

  return { completedTasks, proposals, errors, skipped, assumptionIds: allAssumptionIds, blockerIds: allBlockerIds, pausedAtPhase };
}

// ---------------------------------------------------------------------------
// Upstream readiness check
// ---------------------------------------------------------------------------

async function checkUpstreamReady(
  projectId: string,
  deps: Phase[]
): Promise<boolean> {
  if (deps.length === 0) return true;

  for (const dep of deps) {
    const artifact = await prisma.phaseArtifact.findFirst({
      where: { projectId, phase: dep },
      orderBy: { version: "desc" },
    });
    if (!artifact || (artifact.status !== "CLEAN" && artifact.status !== "CLEAN_WITH_EXCEPTIONS")) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Fetch upstream content helpers
// ---------------------------------------------------------------------------

async function getUpstreamContent(
  projectId: string,
  phase: Phase
): Promise<Record<string, unknown>> {
  const artifact = await prisma.phaseArtifact.findFirst({
    where: { projectId, phase },
    orderBy: { version: "desc" },
  });
  return (artifact?.contentJson as Record<string, unknown>) ?? {};
}

// ---------------------------------------------------------------------------
// Phase agent dispatcher
// ---------------------------------------------------------------------------

/**
 * Wrapper that executes the phase agent, then persists any assumptions
 * and detected blockers it surfaced.
 */
async function executePhaseAgentWithAssumptions(
  taskId: string,
  projectId: string,
  projectName: string,
  phase: Phase,
  snapshotId: string,
  recomputeJobId: string
): Promise<{ proposalId: string; assumptionIds: string[]; blockerIds: string[] }> {
  const { proposedJson, markdown, aiRunIds, assumptions, detectedBlockers } = await executePhaseAgent(
    projectId, projectName, phase
  );

  // Persist assumptions for human verification
  let assumptionIds: string[] = [];
  if (assumptions.length > 0) {
    assumptionIds = await persistPhaseAssumptions(
      projectId, phase, assumptions, recomputeJobId
    );
  }

  // Persist detected blockers
  let blockerIds: string[] = [];
  if (detectedBlockers.length > 0) {
    blockerIds = await persistDetectedBlockers(
      projectId, detectedBlockers, phase, `${phase}-agent`
    );
  }

  // Create proposal via shared helper
  const proposalId = await createProposal(
    taskId, projectId, phase, snapshotId, proposedJson, markdown, aiRunIds
  );

  return { proposalId, assumptionIds, blockerIds };
}

/**
 * Phase agent dispatcher. Executes the correct AI agent for each phase.
 * Returns proposed content, markdown, AI run IDs, and extracted assumptions.
 */
async function executePhaseAgent(
  projectId: string,
  projectName: string,
  phase: Phase
): Promise<{
  proposedJson: Record<string, unknown>;
  markdown: string;
  aiRunIds: string[];
  assumptions: AssumptionItem[];
  detectedBlockers: BlockerDetection[];
}> {
  let proposedJson: Record<string, unknown>;
  let markdown: string;
  let aiRunIds: string[] = [];
  let assumptions: AssumptionItem[] = [];
  let detectedBlockers: BlockerDetection[] = [];

  switch (phase) {
    case "DISCOVERY": {
      const pipeline = await runDiscoveryPipeline(projectId, projectName);
      proposedJson = {
        companySnapshot: pipeline.recon.companySnapshot,
        technicalFindings: pipeline.recon.technicalFindings,
        signals: pipeline.signals.signals,
        maturity: pipeline.maturity.maturity,
        maturityMeta: {
          strengthAreas: pipeline.maturity.strengthAreas,
          gapAreas: pipeline.maturity.gapAreas,
          confidenceBySignal: pipeline.maturity.confidenceBySignal,
        },
        publicFootprint: pipeline.recon.publicFootprint,
        hypothesis: {
          text: pipeline.hypothesis.hypothesis,
          evidenceIds: pipeline.hypothesis.hypothesisEvidenceIds,
          recommendedApproach: pipeline.hypothesis.recommendedApproach,
          conversationAngle: pipeline.hypothesis.conversationAngle,
        },
        stakeholderTargets: pipeline.hypothesis.stakeholderTargets,
        firstMeetingAgenda: pipeline.hypothesis.firstMeetingAgenda,
        citations: pipeline.allCitations,
        validatedEvidenceIds: pipeline.validatedEvidenceIds,
      };
      markdown = pipeline.brief.briefMarkdown;
      aiRunIds = pipeline.aiRunIds;
      // Discovery pipeline is multi-agent; assumptions and blockers come from each sub-agent
      assumptions = (pipeline.assumptions ?? []) as AssumptionItem[];
      detectedBlockers = (pipeline.detectedBlockers ?? []) as BlockerDetection[];
      break;
    }

    case "CURRENT_TOPOLOGY": {
      const discovery = await getUpstreamContent(projectId, "DISCOVERY");
      const result = await runCurrentTopologyBuilder(projectId, projectName, discovery);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = topologyToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "DESIRED_FUTURE_STATE": {
      const discovery = await getUpstreamContent(projectId, "DISCOVERY");
      const topology = await getUpstreamContent(projectId, "CURRENT_TOPOLOGY");
      const result = await runFutureStateDesigner(projectId, projectName, topology, discovery);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = futureStateToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "SOLUTION_DESIGN": {
      const discovery = await getUpstreamContent(projectId, "DISCOVERY");
      const topology = await getUpstreamContent(projectId, "CURRENT_TOPOLOGY");
      const futureState = await getUpstreamContent(projectId, "DESIRED_FUTURE_STATE");
      const result = await runSolutionDesigner(projectId, projectName, topology, futureState, discovery);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = solutionDesignToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "INFRASTRUCTURE": {
      const topology = await getUpstreamContent(projectId, "CURRENT_TOPOLOGY");
      const solution = await getUpstreamContent(projectId, "SOLUTION_DESIGN");
      const discovery = await getUpstreamContent(projectId, "DISCOVERY");
      const result = await runInfrastructurePlanner(projectId, projectName, solution, topology, discovery);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = infrastructureToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "TEST_DESIGN": {
      const topology = await getUpstreamContent(projectId, "CURRENT_TOPOLOGY");
      const solution = await getUpstreamContent(projectId, "SOLUTION_DESIGN");
      const result = await runTestDesigner(projectId, projectName, solution, topology);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = testDesignToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "CRAFT_SOLUTION": {
      const topology = await getUpstreamContent(projectId, "CURRENT_TOPOLOGY");
      const solution = await getUpstreamContent(projectId, "SOLUTION_DESIGN");
      const testDesign = await getUpstreamContent(projectId, "TEST_DESIGN");
      const result = await runCraftSolution(projectId, projectName, solution, testDesign, topology);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = craftSolutionToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "TEST_SOLUTION": {
      const craft = await getUpstreamContent(projectId, "CRAFT_SOLUTION");
      const testDesign = await getUpstreamContent(projectId, "TEST_DESIGN");
      const result = await runTestSolution(projectId, projectName, craft, testDesign);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = testSolutionToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "DEPLOYMENT_PLAN": {
      const testSol = await getUpstreamContent(projectId, "TEST_SOLUTION");
      const craftSol = await getUpstreamContent(projectId, "CRAFT_SOLUTION");
      const topology = await getUpstreamContent(projectId, "CURRENT_TOPOLOGY");
      const discovery = await getUpstreamContent(projectId, "DISCOVERY");
      const result = await runDeploymentPlanner(projectId, projectName, testSol, craftSol, topology, discovery);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = deploymentPlanToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "MONITORING": {
      const deployment = await getUpstreamContent(projectId, "DEPLOYMENT_PLAN");
      const solution = await getUpstreamContent(projectId, "SOLUTION_DESIGN");
      const topology = await getUpstreamContent(projectId, "CURRENT_TOPOLOGY");
      const testDesignContent = await getUpstreamContent(projectId, "TEST_DESIGN");
      const result = await runMonitoringPlanner(projectId, projectName, deployment, solution, topology, testDesignContent);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = monitoringToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "ITERATION": {
      const monitoring = await getUpstreamContent(projectId, "MONITORING");
      const discovery = await getUpstreamContent(projectId, "DISCOVERY");
      const topology = await getUpstreamContent(projectId, "CURRENT_TOPOLOGY");
      const result = await runIterationPlanner(projectId, projectName, monitoring, discovery, topology);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = iterationToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    default:
      throw new Error(`Phase ${phase} agent not implemented`);
  }

  return { proposedJson, markdown, aiRunIds, assumptions, detectedBlockers };
}

// ---------------------------------------------------------------------------
// Shared proposal creation
// ---------------------------------------------------------------------------

async function createProposal(
  taskId: string,
  projectId: string,
  phase: Phase,
  snapshotId: string,
  proposedJson: Record<string, unknown>,
  markdown: string,
  aiRunIds: string[]
): Promise<string> {
  const currentArtifact = await prisma.phaseArtifact.findFirst({
    where: { projectId, phase },
    orderBy: { version: "desc" },
  });

  const baseContent = currentArtifact?.contentJson ?? {};
  const baseVersion = currentArtifact?.version ?? 0;

  const patchOps = generatePatch(baseContent, proposedJson);
  const diffSummary = generateDiffSummary(patchOps);

  const proposal = await prisma.proposal.create({
    data: {
      projectId,
      phase,
      snapshotId,
      baseArtifactVersion: baseVersion,
      patchJson: patchOps as unknown as Prisma.InputJsonValue,
      proposedJson: proposedJson as unknown as Prisma.InputJsonValue,
      proposedMarkdown: markdown,
      diffSummary,
      aiRunIds: aiRunIds as Prisma.InputJsonValue,
    },
  });

  await prisma.recomputeTask.update({
    where: { id: taskId },
    data: { proposalId: proposal.id },
  });

  if (currentArtifact) {
    await prisma.phaseArtifact.update({
      where: { id: currentArtifact.id },
      data: { status: "NEEDS_REVIEW" },
    });
  }

  return proposal.id;
}

// ---------------------------------------------------------------------------
// Stale placeholder for unimplemented phases
// ---------------------------------------------------------------------------

async function createStalePlaceholder(
  taskId: string,
  projectId: string,
  phase: Phase,
  snapshotId: string,
  phaseLabel: string
): Promise<string> {
  const currentArtifact = await prisma.phaseArtifact.findFirst({
    where: { projectId, phase },
    orderBy: { version: "desc" },
  });

  const proposal = await prisma.proposal.create({
    data: {
      projectId,
      phase,
      snapshotId,
      baseArtifactVersion: currentArtifact?.version ?? 0,
      patchJson: [] as Prisma.InputJsonValue,
      proposedJson: {
        _placeholder: true,
        message: `${phaseLabel} phase is not yet implemented.`,
      } as Prisma.InputJsonValue,
      proposedMarkdown: `> **${phaseLabel}** phase is not yet implemented.\n\nThis phase will be automatically recomputed when its agent pipeline is built.`,
      diffSummary: `Phase "${phaseLabel}" is not yet implemented. Marked as stale.`,
      status: "PENDING",
    },
  });

  if (currentArtifact) {
    await prisma.phaseArtifact.update({
      where: { id: currentArtifact.id },
      data: { status: "STALE" },
    });
  }

  await prisma.recomputeTask.update({
    where: { id: taskId },
    data: { proposalId: proposal.id, message: `Stale: ${phaseLabel} not implemented` },
  });

  return proposal.id;
}
