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

TASK: Given the monitoring signals, discovery context, current topology, and any prior iteration plans, produce a structured iteration backlog.

RULES:
- Backlog items must be actionable and mapped to specific topology components (targetComponentIds).
- Every item must cite at least one evidenceId in brackets like [EVIDENCE-1].
- Item IDs must follow pattern: ITER-1, ITER-2, etc.
- Priority matrix must categorize items into: criticalPath, quickWins, strategicInvestments, deferred.
- Drift analysis must compare current state against desired future state.
- triggerSource must reflect why this item exists (monitoring signal, user feedback, drift, failure, proactive).
- If you cannot determine priority from evidence, set confidence to "Low" and explain.
- Do NOT hallucinate evidence IDs. Only use evidence IDs from the provided context.
- Return strict JSON matching the schema exactly.`;

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
  ]);

  const evidenceBlock = formatEvidenceForPrompt(evidence);

  const userPrompt = `## Project: ${projectName}

## Monitoring Signals
${JSON.stringify(monitoringContent, null, 2).slice(0, 3000)}

## Discovery Context
${JSON.stringify(discoveryContent, null, 2).slice(0, 2000)}

## Current Topology
${JSON.stringify(topologyContent, null, 2).slice(0, 2000)}

## Evidence
${evidenceBlock}

Produce a JSON iteration plan with: backlogItems (each with unique id like ITER-1), priorityMatrix, driftAnalysis, nextCycleRecommendation.`;

  return runAgent<IterationOutput>({
    agentType: "iterationPlanner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: iterationOutputSchema,
  });
}
