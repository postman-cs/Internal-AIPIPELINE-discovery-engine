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

TASK: Given the deployment plan, solution design, current topology, and test design, produce a structured monitoring plan with Postman Monitor configurations for production health.

RULES:
- Every monitor and SLO must be mapped to a specific topology component (targetComponentId).
- Every meaningful claim must cite at least one evidenceId in brackets like [EVIDENCE-1].
- Monitor IDs must follow pattern: MON-1, MON-2, etc.
- SLOs must have measurable targets and time windows.
- Alert rules must have clear severity levels and actions.
- Renewal signals should cover both positive and negative indicators.
- If you cannot determine a monitoring need from evidence, set confidence to "Low".
- Do NOT hallucinate evidence IDs. Only use evidence IDs from the provided context.
- Return strict JSON matching the schema exactly.

POSTMAN MONITORS:
- postmanMonitors: define Postman Monitor configurations for ongoing production health checks. Each monitor should:
  - collectionRef: reference a Postman collection (from CRAFT_SOLUTION) that contains the health check requests
  - environmentRef: the environment to run against (e.g. "production", "staging")
  - schedule: how often to run (e.g. "every 5 minutes", "every hour", "every 15 minutes")
  - regions: which Postman cloud regions to run from for geographic coverage (e.g. ["us-east-1", "eu-west-1", "ap-southeast-1"])
  - alertChannels: where to send alerts on failure (e.g. ["slack:#api-alerts", "email:oncall@company.com", "pagerduty"])
  - targetComponentId: which topology component this monitors
  Create monitors for: critical API health checks, authentication flows, key integration points, and SLO compliance.`;

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

Produce a JSON monitoring plan with: monitors (each with unique id like MON-1), sloDefinitions, alertRules, dashboardSpec, renewalSignals, postmanMonitors.`;

  return runAgent<MonitoringOutput>({
    agentType: "monitoringPlanner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: monitoringOutputSchema,
  });
}
