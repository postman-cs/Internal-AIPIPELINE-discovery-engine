/**
 * Deployment Plan Agent
 *
 * Phase: DEPLOYMENT_PLAN
 * Input: TEST_SOLUTION output, CRAFT_SOLUTION output, CURRENT_TOPOLOGY, DISCOVERY findings
 * Output: Structured deployment steps, change management, training, communication, go-live criteria
 *
 * Every claim must cite evidenceIds. Zod validated.
 */

import { runAgent } from "./runner";
import {
  deploymentPlanOutputSchema,
  type DeploymentPlanOutput,
} from "./topologyTypes";
import {
  retrieveMultiQueryEvidence,
  formatEvidenceForPrompt,
} from "@/lib/ai/retrieval";

const SYSTEM_PROMPT = `You are a senior Solutions Engineer at Postman building a deployment plan for a customer's API platform transformation.

TASK: Given the test solution results, craft solution implementation plan, current topology, and discovery context, produce a structured deployment plan.

RULES:
- Every deployment step must cite at least one evidenceId from the provided evidence in brackets like [EVIDENCE-1].
- If you are uncertain about a claim, set confidence to "Low" and explain what needs validation.
- Deployment steps must be ordered logically (dependencies first).
- Each step must have a rollback plan.
- Training requirements must target specific audiences.
- Go-live criteria must be measurable.
- Do NOT hallucinate evidence IDs. Only use evidence IDs from the provided context.
- Return strict JSON matching the schema exactly.`;

export async function runDeploymentPlanner(
  projectId: string,
  projectName: string,
  testSolutionContent: Record<string, unknown>,
  craftSolutionContent: Record<string, unknown>,
  topologyContent: Record<string, unknown>,
  discoveryContent: Record<string, unknown>
) {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    "deployment rollout plan migration",
    "change management training stakeholders",
    "go-live criteria production readiness",
    "risk rollback contingency plan",
  ]);

  const evidenceBlock = formatEvidenceForPrompt(evidence);

  const userPrompt = `## Project: ${projectName}

## Test Solution Results
${JSON.stringify(testSolutionContent, null, 2).slice(0, 3000)}

## Craft Solution Plan
${JSON.stringify(craftSolutionContent, null, 2).slice(0, 3000)}

## Current Topology Summary
${JSON.stringify(topologyContent, null, 2).slice(0, 2000)}

## Discovery Context
${JSON.stringify(discoveryContent, null, 2).slice(0, 2000)}

## Evidence
${evidenceBlock}

Produce a JSON deployment plan with: deploymentSteps, changeManagementNotes, trainingRequirements, communicationPlan, goLiveCriteria, overallTimeline.`;

  return runAgent<DeploymentPlanOutput>({
    agentType: "deploymentPlanner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: deploymentPlanOutputSchema,
  });
}
