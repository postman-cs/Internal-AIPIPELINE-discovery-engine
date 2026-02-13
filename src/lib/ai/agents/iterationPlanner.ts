/**
 * Iteration Planner Agent
 *
 * Phase: ITERATION
 * Input: MONITORING output, DISCOVERY findings, CURRENT_TOPOLOGY, prior iteration (if any)
 * Output: Backlog items, priority matrix, drift analysis, next cycle recommendation
 *
 * Every claim must cite evidenceIds. Zod validated.
 */

import { runAgent } from "./runner";
import {
  iterationOutputSchema,
  type IterationOutput,
} from "./topologyTypes";
import {
  retrieveMultiQueryEvidence,
  formatEvidenceForPrompt,
} from "@/lib/ai/retrieval";

const SYSTEM_PROMPT = `You are a senior Solutions Engineer at Postman planning the next iteration cycle for a customer's API platform transformation.

TASK: Given the monitoring signals, discovery context, current topology, and adoption metrics, produce a structured iteration backlog that includes WIDE ADOPTION ACCELERATION items.

RULES:
- Backlog items must be actionable and mapped to specific topology components (targetComponentIds).
- Every item must cite at least one evidenceId in brackets like [EVIDENCE-1].
- Item IDs must follow pattern: ITER-1, ITER-2, etc.
- Priority matrix must categorize items into: criticalPath, quickWins, strategicInvestments, deferred.
- Drift analysis must compare current state against desired future state.
- triggerSource must reflect why this item exists (monitoring signal, user feedback, drift, failure, proactive, adoption_expansion).
- If you cannot determine priority from evidence, set confidence to "Low" and explain.
- Do NOT hallucinate evidence IDs. Only use evidence IDs from the provided context.
- Return strict JSON matching the schema exactly.

WIDE ADOPTION ACCELERATION (IMPORTANT):
You MUST include backlog items focused on expanding Postman Enterprise adoption across the organization.
These should cover:
- Next wave planning: which teams should adopt next, and what needs to happen first
- Champion cultivation: identifying and enabling champions in new teams
- Drip campaign recommendations: what content should be sent to which teams, when
- Cross-team pollination: pairing adopted teams with prospective teams
- Competitive displacement: migrating teams off competing tools
- Friction point resolution: addressing specific adoption blockers
- Success story amplification: sharing wins from early adopters to motivate later waves
- Executive communication: what metrics to present and when
- Milestone targets: what the next celebration-worthy milestone should be

Include at least 3-5 adoption expansion items in the backlog. Mark their triggerSource as "adoption_expansion".
These are CRITICAL for driving org-wide adoption and should appear in quickWins or strategicInvestments.`;

export async function runIterationPlanner(
  projectId: string,
  projectName: string,
  monitoringContent: Record<string, unknown>,
  discoveryContent: Record<string, unknown>,
  topologyContent: Record<string, unknown>
) {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    "incidents failures errors degradation",
    "customer feedback feature requests satisfaction",
    "API drift schema changes breaking changes",
    "adoption usage growth patterns optimization",
    "team onboarding training adoption expansion",
  ]);

  const evidenceBlock = formatEvidenceForPrompt(evidence);

  // Gather adoption metrics for context
  let adoptionContext = "No adoption tracking data available yet.";
  try {
    const { prisma } = await import("@/lib/prisma");
    const [teams, waves, milestones] = await Promise.all([
      prisma.adoptionTeam.findMany({ where: { projectId }, select: {
        name: true, department: true, adoptionStage: true, adoptionScore: true,
        teamSize: true, ciPipelinesActive: true, championActive: true,
        resistanceLevel: true, existingTools: true,
      }}),
      prisma.adoptionWave.findMany({ where: { projectId }, orderBy: { waveNumber: "asc" }, select: {
        waveNumber: true, name: true, status: true, actualTeamCount: true, targetTeamCount: true,
      }}),
      prisma.adoptionMilestone.findMany({ where: { projectId }, orderBy: { celebratedAt: "desc" }, take: 5, select: {
        type: true, title: true, celebratedAt: true,
      }}),
    ]);

    if (teams.length > 0) {
      const adopted = teams.filter((t) => t.adoptionStage === "adopted" || t.adoptionStage === "champion");
      const unaware = teams.filter((t) => t.adoptionStage === "unaware");
      const withResistance = teams.filter((t) => t.resistanceLevel !== "none");

      adoptionContext = `## Adoption Status
- Total teams tracked: ${teams.length}
- Adopted/Champion: ${adopted.length} (${Math.round((adopted.length / teams.length) * 100)}%)
- Unaware: ${unaware.length}
- Teams with resistance: ${withResistance.length}

### Teams:
${teams.map((t) => `- ${t.name} (${t.department ?? "?"}): stage=${t.adoptionStage}, score=${t.adoptionScore}, CI=${t.ciPipelinesActive}, champion=${t.championActive}, resistance=${t.resistanceLevel}, tools=${JSON.stringify(t.existingTools ?? [])}`).join("\n")}

### Waves:
${waves.length > 0 ? waves.map((w) => `- Wave ${w.waveNumber}: ${w.name} (${w.status}) — ${w.actualTeamCount}/${w.targetTeamCount} teams`).join("\n") : "No waves planned yet."}

### Recent Milestones:
${milestones.length > 0 ? milestones.map((m) => `- ${m.title} (${m.type}) — ${m.celebratedAt.toISOString().split("T")[0]}`).join("\n") : "No milestones yet."}`;
    }
  } catch {
    // Non-fatal: proceed without adoption data
  }

  const userPrompt = `## Project: ${projectName}

## Monitoring Signals
${JSON.stringify(monitoringContent, null, 2).slice(0, 3000)}

## Discovery Context
${JSON.stringify(discoveryContent, null, 2).slice(0, 2000)}

## Current Topology
${JSON.stringify(topologyContent, null, 2).slice(0, 2000)}

${adoptionContext}

## Evidence
${evidenceBlock}

Produce a JSON iteration plan with: backlogItems (each with unique id like ITER-1), priorityMatrix, driftAnalysis, nextCycleRecommendation.
IMPORTANT: Include at least 3-5 backlog items focused on wide adoption expansion (triggerSource: "adoption_expansion").`;

  return runAgent<IterationOutput>({
    agentType: "iterationPlanner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: iterationOutputSchema,
  });
}
