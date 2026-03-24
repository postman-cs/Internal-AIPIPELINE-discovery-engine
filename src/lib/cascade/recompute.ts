/**
 * Recompute Engine
 *
 * Executes recompute tasks for DIRTY phases.
 * Dispatches to the correct AI agent for each implemented phase.
 * Skips phases whose upstream dependencies aren't CLEAN yet.
 * Generates Proposals — never directly writes artifacts.
 *
 * Optimisations:
 * - Phases at the same topological tier run concurrently (Promise.all).
 * - Upstream readiness is checked in a single batched query per tier.
 * - BUILD_LOG is skipped in automated cascades (manual-only).
 * - Prior proposal content is reused when upstream versions + snapshot match.
 * - Agent calls are wrapped with a configurable timeout and a single retry.
 * - Token usage from AIRun records is tracked per task.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { Phase } from "@prisma/client";
import { getPhaseNode, getDependencies, getTopologicalTiers } from "./phases";
import { generatePatch, generateDiffSummary } from "./patch";
import type { Prisma } from "@prisma/client";
import { persistPhaseAssumptions, isPhaseGateClear, autoVerifyAssumptions } from "@/lib/assumptions/engine";
import { persistDetectedBlockers } from "@/lib/blockers/engine";
import { pluginRegistry } from "@/lib/ai/plugins";
import { applyProposal } from "@/lib/actions/cascade";
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
import { runInfrastructurePlanner } from "@/lib/ai/agents/infrastructurePlanner";
import { runBuildLogGenerator, buildLogToMarkdown } from "@/lib/ai/agents/buildLogGenerator";

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
} from "@/lib/ai/agents/topologyTypes";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AGENT_TIMEOUT_MS = parseInt(
  process.env.CASCADE_AGENT_TIMEOUT_MS ?? "600000",
  10
);

// ---------------------------------------------------------------------------
// Timeout & retry helpers
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Agent timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  baseDelayMs = 2000
): Promise<T> {
  let lastError!: Error;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Input-hash helpers (for cascade result caching)
// ---------------------------------------------------------------------------

function computeInputHash(
  snapshotId: string,
  upstreamVersions: Record<string, number>
): string {
  const sorted = Object.entries(upstreamVersions).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const payload = `${snapshotId}|${sorted.map(([p, v]) => `${p}@${v}`).join(",")}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

async function checkCacheHit(
  projectId: string,
  phase: Phase,
  currentInputHash: string
): Promise<{
  proposedJson: Record<string, unknown>;
  markdown: string;
  aiRunIds: string[];
} | null> {
  const lastAccepted = await prisma.proposal.findFirst({
    where: { projectId, phase, status: "ACCEPTED" },
    orderBy: { createdAt: "desc" },
  });
  if (!lastAccepted) return null;

  const producerTask = await prisma.recomputeTask.findFirst({
    where: { proposalId: lastAccepted.id },
  });
  if (!producerTask) return null;

  const inputRefs = producerTask.inputRefsJson as {
    upstreamVersions?: Record<string, number>;
    snapshotId?: string;
  };
  const cachedHash = computeInputHash(
    inputRefs.snapshotId ?? "",
    inputRefs.upstreamVersions ?? {}
  );
  if (cachedHash !== currentInputHash) return null;

  return {
    proposedJson: lastAccepted.proposedJson as Record<string, unknown>,
    markdown: lastAccepted.proposedMarkdown ?? "",
    aiRunIds: (lastAccepted.aiRunIds as string[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Batched upstream readiness
// ---------------------------------------------------------------------------

interface ArtifactInfo {
  version: number;
  status: string;
}

async function batchCheckUpstreamArtifacts(
  projectId: string,
  deps: Phase[]
): Promise<Map<Phase, ArtifactInfo>> {
  if (deps.length === 0) return new Map();

  const artifacts = await prisma.phaseArtifact.findMany({
    where: { projectId, phase: { in: deps } },
    orderBy: { version: "desc" },
    distinct: ["phase"],
    select: { phase: true, version: true, status: true },
  });

  return new Map(
    artifacts.map((a) => [a.phase, { version: a.version, status: a.status }])
  );
}

function isArtifactReady(info: ArtifactInfo | undefined): boolean {
  return !!info && (info.status === "CLEAN" || info.status === "CLEAN_WITH_EXCEPTIONS");
}

// ---------------------------------------------------------------------------
// Token usage tracking
// ---------------------------------------------------------------------------

async function getTokenUsageFromRuns(aiRunIds: string[]): Promise<number> {
  if (aiRunIds.length === 0) return 0;
  try {
    const runs = await prisma.aIRun.findMany({
      where: { id: { in: aiRunIds } },
      select: { tokenUsage: true },
    });
    let total = 0;
    for (const run of runs) {
      if (run.tokenUsage && typeof run.tokenUsage === "object") {
        const usage = run.tokenUsage as Record<string, number>;
        total += usage.totalTokens ?? usage.total_tokens ?? 0;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Single-task result type
// ---------------------------------------------------------------------------

interface TaskResult {
  phase: Phase;
  status: "completed" | "skipped" | "failed";
  proposalId?: string;
  assumptionIds: string[];
  blockerIds: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Execute all tasks in a RecomputeJob.
 * Groups tasks by topological tier and runs each tier concurrently.
 * Skips phases whose upstream dependencies aren't satisfied.
 *
 * Assumption Verification Integration:
 * - After each agent runs, its assumptions are persisted for human review.
 * - In "gated" mode: pauses at each tier with critical unverified assumptions.
 * - In "eager" mode (default): runs all phases, surfaces all assumptions at once.
 * - Verified/corrected assumptions from prior runs are injected into agent prompts
 *   automatically via the runner's constraint injection.
 */
export async function executeRecomputeJob(
  jobId: string,
  options?: {
    /** If true, pause execution when a phase has unverified High-confidence assumptions */
    gatedMode?: boolean;
    /** If true, auto-accept proposals so phases become CLEAN and downstream phases can proceed */
    autoAccept?: boolean;
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

  const tiers = getTopologicalTiers();
  const sortedTierKeys = [...tiers.keys()].sort((a, b) => a - b);
  const taskByPhase = new Map(job.tasks.map((t) => [t.phase, t]));

  const proposals: string[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];
  const allAssumptionIds: string[] = [];
  const allBlockerIds: string[] = [];
  let completedTasks = 0;
  let pausedAtPhase: string | undefined;

  for (const tierKey of sortedTierKeys) {
    if (pausedAtPhase) break;

    const tierPhases = tiers.get(tierKey)!;

    const tierTasks = tierPhases
      .map((p) => taskByPhase.get(p))
      .filter(
        (t): t is NonNullable<typeof t> => t != null && t.status === "PENDING"
      );

    if (tierTasks.length === 0) continue;

    // --- Gated mode: check assumption gates before starting this tier -------
    if (options?.gatedMode && completedTasks > 0) {
      let gateBlocked = false;
      for (const task of tierTasks) {
        const gate = await isPhaseGateClear(job.projectId, task.phase);
        if (!gate.clear) {
          gateBlocked = true;
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

          for (const remaining of job.tasks) {
            if (remaining.status === "PENDING" && remaining.id !== task.id) {
              const rNode = getPhaseNode(remaining.phase);
              const tNode = getPhaseNode(task.phase);
              if (rNode.order >= tNode.order) {
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
          break;
        }
      }
      if (gateBlocked) break;
    }

    // --- Point 5: batch upstream readiness for the whole tier ---------------
    const allDepsInTier = new Set<Phase>();
    for (const task of tierTasks) {
      for (const dep of getDependencies(task.phase)) {
        allDepsInTier.add(dep);
      }
    }
    const upstreamInfo = await batchCheckUpstreamArtifacts(
      job.projectId,
      [...allDepsInTier]
    );

    // --- Point 1: run tier tasks concurrently ------------------------------
    const results = await Promise.all(
      tierTasks.map((task) =>
        processSingleTask(task, job, upstreamInfo)
      )
    );

    // --- Collect results & auto-accept -------------------------------------
    for (const result of results) {
      switch (result.status) {
        case "completed":
          completedTasks++;
          if (result.proposalId) proposals.push(result.proposalId);
          allAssumptionIds.push(...result.assumptionIds);
          allBlockerIds.push(...result.blockerIds);

          if (options?.autoAccept && result.proposalId) {
            try {
              await applyProposal(result.proposalId, { skipMarkDirty: true });
              console.info(`[cascade] Auto-accepted ${result.phase} → CLEAN`);
            } catch (applyErr) {
              const msg = applyErr instanceof Error ? applyErr.message : String(applyErr);
              console.error(`[cascade] Auto-accept failed for ${result.phase}: ${msg}`);
              errors.push(`${result.phase}: auto-accept failed: ${msg}`);
            }
          }
          break;
        case "skipped":
          console.warn(`[cascade] SKIPPED ${result.phase}: upstream not ready`);
          skipped.push(result.phase);
          break;
        case "failed":
          console.error(`[cascade] FAILED ${result.phase}: ${result.error}`);
          if (result.error) errors.push(`${result.phase}: ${result.error}`);
          break;
      }
    }
  }

  console.info(`[cascade] Job ${jobId} done: ${completedTasks} completed, ${skipped.length} skipped, ${errors.length} errors`, { skipped, errors });

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

  return {
    completedTasks,
    proposals,
    errors,
    skipped,
    assumptionIds: allAssumptionIds,
    blockerIds: allBlockerIds,
    pausedAtPhase,
  };
}

// ---------------------------------------------------------------------------
// Single task processor (runs inside Promise.all per tier)
// ---------------------------------------------------------------------------

async function processSingleTask(
  task: { id: string; phase: Phase; status: string },
  job: {
    id: string;
    projectId: string;
    snapshotId: string | null;
    project: { name: string };
  },
  upstreamInfo: Map<Phase, ArtifactInfo>
): Promise<TaskResult> {
  const { phase } = task;
  const snapshotId = job.snapshotId || "";

  try {
    // --- Point 12: persist startedAt ---------------------------------------
    await prisma.recomputeTask.update({
      where: { id: task.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const node = getPhaseNode(phase);

    if (!node.implemented) {
      const proposalId = await createStalePlaceholder(
        task.id,
        job.projectId,
        phase,
        snapshotId,
        node.label
      );
      await prisma.recomputeTask.update({
        where: { id: task.id },
        data: { status: "COMPLETED", finishedAt: new Date() },
      });
      return { phase, status: "completed", proposalId, assumptionIds: [], blockerIds: [] };
    }

    // Check upstream dependencies via the pre-fetched batch result
    const deps = getDependencies(phase);
    if (phase !== "DISCOVERY") {
      const allReady = deps.every((dep) => isArtifactReady(upstreamInfo.get(dep)));
      if (!allReady) {
        await prisma.recomputeTask.update({
          where: { id: task.id },
          data: {
            status: "SKIPPED",
            message: `Upstream dependencies not ready: ${deps.join(", ")}`,
            finishedAt: new Date(),
          },
        });
        return { phase, status: "skipped", assumptionIds: [], blockerIds: [] };
      }
    }

    // --- Point 9: cascade result caching -----------------------------------
    const upstreamVersions: Record<string, number> = {};
    for (const dep of deps) {
      const info = upstreamInfo.get(dep);
      if (info) upstreamVersions[dep] = info.version;
    }
    const inputHash = computeInputHash(snapshotId, upstreamVersions);

    const cached = await checkCacheHit(job.projectId, phase, inputHash);
    if (cached) {
      const proposalId = await createProposal(
        task.id,
        job.projectId,
        phase,
        snapshotId,
        cached.proposedJson,
        cached.markdown,
        [...cached.aiRunIds, "cache-hit"]
      );
      await prisma.recomputeTask.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          message: "Cache hit — reused prior proposal",
        },
      });
      return { phase, status: "completed", proposalId, assumptionIds: [], blockerIds: [] };
    }

    // --- Point 11: agent timeout + single retry ----------------------------
    const agentResult = await withRetry(
      () => withTimeout(
        executePhaseAgent(job.projectId, job.project.name, phase),
        AGENT_TIMEOUT_MS
      )
    );

    let assumptionIds: string[] = [];
    if (agentResult.assumptions.length > 0) {
      assumptionIds = await persistPhaseAssumptions(
        job.projectId,
        phase,
        agentResult.assumptions,
        job.id,
      );
      try {
        await autoVerifyAssumptions(job.projectId, agentResult.assumptions);
      } catch { /* non-fatal: auto-verification is best-effort */ }
    }

    let blockerIds: string[] = [];
    if (agentResult.detectedBlockers.length > 0) {
      blockerIds = await persistDetectedBlockers(
        job.projectId,
        agentResult.detectedBlockers,
        phase,
        `${phase}-agent`
      );
    }

    const proposalId = await createProposal(
      task.id,
      job.projectId,
      phase,
      snapshotId,
      agentResult.proposedJson,
      agentResult.markdown,
      agentResult.aiRunIds
    );

    // --- Point 12: token usage tracking + finishedAt -----------------------
    const tokenTotal = await getTokenUsageFromRuns(agentResult.aiRunIds);
    await prisma.recomputeTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        message: tokenTotal > 0 ? `Completed (${tokenTotal} tokens)` : undefined,
      },
    });

    return { phase, status: "completed", proposalId, assumptionIds, blockerIds };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await prisma.recomputeTask.update({
      where: { id: task.id },
      data: { status: "FAILED", message: msg, finishedAt: new Date() },
    });
    return { phase, status: "failed", error: msg, assumptionIds: [], blockerIds: [] };
  }
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

async function getKeplerContextBlock(projectId: string): Promise<string> {
  const artifact = await prisma.discoveryArtifact.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    select: {
      industry: true,
      engineeringSize: true,
      maturityLevel: true,
      publicApiPresence: true,
      keplerPaste: true,
      cloudGatewaySignals: true,
    },
  });
  if (!artifact) return "";

  const parts: string[] = ["PROJECT CONTEXT:"];
  if (artifact.industry) parts.push(`  Industry: ${artifact.industry}`);
  if (artifact.engineeringSize) parts.push(`  Engineering: ${artifact.engineeringSize} engineers`);
  if (artifact.maturityLevel != null) parts.push(`  Maturity Level: ${artifact.maturityLevel}`);
  if (artifact.publicApiPresence) parts.push(`  Public API Presence: ${artifact.publicApiPresence}`);
  if (artifact.cloudGatewaySignals) parts.push(`  Cloud/Gateway Signals: ${artifact.cloudGatewaySignals.slice(0, 500)}`);

  return parts.length > 1 ? parts.join("\n") + "\n" : "";
}

async function getServiceTemplateContext(
  projectId: string
): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      serviceTemplateContent: true,
      serviceTemplateType: true,
      serviceTemplateFileName: true,
    },
  });
  if (!project?.serviceTemplateContent) return null;
  const typeLabel = project.serviceTemplateType ?? "custom";
  const fileName = project.serviceTemplateFileName ?? "template";
  const langHint = typeLabel === "openapi" ? "yaml" : typeLabel === "postman-collection" ? "json" : typeLabel;
  return `## Customer Service Template (${typeLabel}: ${fileName})\n\`\`\`${langHint}\n${project.serviceTemplateContent}\n\`\`\``;
}

// ---------------------------------------------------------------------------
// Phase agent dispatcher
// ---------------------------------------------------------------------------

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
  const plugin = pluginRegistry.getPlugin(phase);
  if (plugin) {
    const result = await plugin.run({
      projectId,
      projectName,
      phase,
      upstreamContent: {},
      evidenceChunks: [],
    });
    return {
      proposedJson: result.proposedJson,
      markdown: result.markdown,
      aiRunIds: result.aiRunIds,
      assumptions: result.assumptions as AssumptionItem[],
      detectedBlockers: result.detectedBlockers as BlockerDetection[],
    };
  }

  let proposedJson: Record<string, unknown>;
  let markdown: string;
  let aiRunIds: string[] = [];
  let assumptions: AssumptionItem[] = [];
  let detectedBlockers: BlockerDetection[] = [];

  // Point 8: Kepler context enrichment for post-DISCOVERY phases
  const keplerContext = phase !== "DISCOVERY" ? await getKeplerContextBlock(projectId) : "";

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
      assumptions = (pipeline.assumptions ?? []) as AssumptionItem[];
      detectedBlockers = (pipeline.detectedBlockers ?? []) as BlockerDetection[];
      break;
    }

    case "CURRENT_TOPOLOGY": {
      const discovery = await getUpstreamContent(projectId, "DISCOVERY");
      if (keplerContext) discovery._projectContext = keplerContext;
      const svcTemplate = await getServiceTemplateContext(projectId);
      const result = await runCurrentTopologyBuilder(projectId, projectName, discovery, svcTemplate);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = topologyToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "DESIRED_FUTURE_STATE": {
      const discovery = await getUpstreamContent(projectId, "DISCOVERY");
      if (keplerContext) discovery._projectContext = keplerContext;
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
      if (keplerContext) discovery._projectContext = keplerContext;
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
      if (keplerContext) discovery._projectContext = keplerContext;
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
      if (keplerContext) topology._projectContext = keplerContext;
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
      if (keplerContext) topology._projectContext = keplerContext;
      const solution = await getUpstreamContent(projectId, "SOLUTION_DESIGN");
      const testDesign = await getUpstreamContent(projectId, "TEST_DESIGN");
      const svcTemplate = await getServiceTemplateContext(projectId);
      const result = await runCraftSolution(projectId, projectName, solution, testDesign, topology, svcTemplate);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = craftSolutionToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "TEST_SOLUTION": {
      const craft = await getUpstreamContent(projectId, "CRAFT_SOLUTION");
      if (keplerContext) craft._projectContext = keplerContext;
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
      if (keplerContext) discovery._projectContext = keplerContext;
      const svcTemplate = await getServiceTemplateContext(projectId);
      const result = await runDeploymentPlanner(projectId, projectName, testSol, craftSol, topology, discovery, svcTemplate);
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = deploymentPlanToMarkdown(result.output);
      aiRunIds = [result.aiRunId];
      assumptions = result.assumptions ?? [];
      detectedBlockers = result.detectedBlockers ?? [];
      break;
    }

    case "MEETINGS":
    case "WORKING_SESSIONS": {
      const existing = await getUpstreamContent(projectId, phase);
      const entries = (existing as Record<string, unknown>)?.entries;
      proposedJson = {
        entries: Array.isArray(entries) ? entries : [],
        totalSessions: Array.isArray(entries) ? entries.length : 0,
        lastSessionAt: Array.isArray(entries) && entries.length > 0
          ? (entries[entries.length - 1] as Record<string, string>)?.date ?? null
          : null,
      };
      markdown = `# ${phase === "MEETINGS" ? "Meetings" : "Working Sessions"}\n\n${
        Array.isArray(entries) ? `${entries.length} transcript(s) ingested` : "No transcripts yet"
      }`;
      aiRunIds = [];
      break;
    }

    case "BUILD_LOG": {
      const allPhases: Phase[] = [
        "DISCOVERY", "CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE",
        "SOLUTION_DESIGN", "INFRASTRUCTURE", "TEST_DESIGN",
        "CRAFT_SOLUTION", "TEST_SOLUTION", "DEPLOYMENT_PLAN",
        "MEETINGS", "WORKING_SESSIONS",
      ];
      const upstreamSummaries: Record<string, unknown> = {};
      for (const p of allPhases) {
        upstreamSummaries[p] = await getUpstreamContent(projectId, p);
      }
      const existingBuildLog = await getUpstreamContent(projectId, "BUILD_LOG");
      const result = await runBuildLogGenerator(
        projectId,
        projectName,
        upstreamSummaries,
        Object.keys(existingBuildLog).length > 0 ? existingBuildLog : undefined,
      );
      proposedJson = result.output as unknown as Record<string, unknown>;
      markdown = buildLogToMarkdown(result.output);
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
