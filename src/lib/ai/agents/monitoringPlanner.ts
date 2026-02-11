/**
 * Monitoring Planner Agent
 *
 * Phase: MONITORING
 * Input: DEPLOYMENT_PLAN output, SOLUTION_DESIGN, CURRENT_TOPOLOGY, TEST_DESIGN
 * Output: Monitors, SLOs, alerts, dashboard spec, renewal signals
 *
 * Every claim must cite evidenceIds. Zod validated.
 */

import { runAgent } from "./runner";
import {
  monitoringOutputSchema,
  type MonitoringOutput,
} from "./topologyTypes";
import {
  retrieveMultiQueryEvidence,
  formatEvidenceForPrompt,
} from "@/lib/ai/retrieval";

const SYSTEM_PROMPT = `You are a senior Solutions Engineer at Postman designing a monitoring and observability strategy for a customer's API platform.

TASK: Given the deployment plan, solution design, current topology, and test design, produce a structured monitoring plan.

RULES:
- Every monitor and SLO must be mapped to a specific topology component (targetComponentId).
- Every meaningful claim must cite at least one evidenceId in brackets like [EVIDENCE-1].
- Monitor IDs must follow pattern: MON-1, MON-2, etc.
- SLOs must have measurable targets and time windows.
- Alert rules must have clear severity levels and actions.
- Renewal signals should cover both positive and negative indicators.
- If you cannot determine a monitoring need from evidence, set confidence to "Low".
- Do NOT hallucinate evidence IDs. Only use evidence IDs from the provided context.
- Return strict JSON matching the schema exactly.`;

export async function runMonitoringPlanner(
  projectId: string,
  projectName: string,
  deploymentContent: Record<string, unknown>,
  solutionContent: Record<string, unknown>,
  topologyContent: Record<string, unknown>,
  testDesignContent: Record<string, unknown>
) {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    "monitoring observability SLO SLA health checks",
    "alerts incidents escalation patterns",
    "API usage metrics performance baselines",
    "customer sentiment adoption renewal signals",
  ]);

  const evidenceBlock = formatEvidenceForPrompt(evidence);

  const userPrompt = `## Project: ${projectName}

## Deployment Plan
${JSON.stringify(deploymentContent, null, 2).slice(0, 3000)}

## Solution Design
${JSON.stringify(solutionContent, null, 2).slice(0, 2000)}

## Current Topology
${JSON.stringify(topologyContent, null, 2).slice(0, 2000)}

## Test Design
${JSON.stringify(testDesignContent, null, 2).slice(0, 2000)}

## Evidence
${evidenceBlock}

Produce a JSON monitoring plan with: monitors (each with unique id like MON-1), sloDefinitions, alertRules, dashboardSpec, renewalSignals.`;

  return runAgent<MonitoringOutput>({
    agentType: "monitoringPlanner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: monitoringOutputSchema,
  });
}
