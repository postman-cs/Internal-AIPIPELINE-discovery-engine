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

const SYSTEM_PROMPT = `You are a CSE at Postman producing a COMPACT deployment plan.

CRITICAL OUTPUT RULES:
- Return a FLAT JSON object. Top-level keys: deploymentSteps, ciCdStages, environmentPromotionGates, trainingRequirements, goLiveCriteria, rollbackPlan, notes
- Do NOT nest under wrapper keys like "deploymentPlan" or "projectName"
- Maximum 5 deploymentSteps
- Maximum 3 ciCdStages (max 15 lines per configSnippet, use "# ..." for omitted parts)
- Maximum 3 environmentPromotionGates
- Maximum 3 trainingRequirements
- Keep ALL string values SHORT (1-2 sentences)
- Cite evidence as [EVIDENCE-N]. Do NOT hallucinate evidence IDs.

ciCdStages: { stageName, platform (github_actions|gitlab_ci|jenkins), platformLabel, configLanguage (yaml|groovy), triggerCondition, configSnippet, gateChecks: string[] }
environmentPromotionGates: { fromEnv, toEnv, requiredChecks: string[], approvalRequired: boolean, newmanSuiteRef? }
deploymentSteps: { order, name, description, duration, rollback, evidenceIds: string[] }
trainingRequirements: { audience, topic, format, duration }
goLiveCriteria: string[]
rollbackPlan: string
notes: string[] (max 3)

OUTPUT: Return ONLY flat JSON. Start with { end with }.`;

export async function runDeploymentPlanner(
  projectId: string,
  projectName: string,
  testSolutionContent: Record<string, unknown>,
  craftSolutionContent: Record<string, unknown>,
  topologyContent: Record<string, unknown>,
  discoveryContent: Record<string, unknown>,
  serviceTemplateContext?: string | null
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

Produce a JSON deployment plan with: deploymentSteps, changeManagementNotes, trainingRequirements, communicationPlan, goLiveCriteria, overallTimeline, ciCdStages (for whatever CI/CD platforms are relevant), environmentPromotionGates.
${serviceTemplateContext ? `\n${serviceTemplateContext}\n\nThe customer's service template is provided above. Use it to inform deployment targets, environment configurations, and pipeline stage definitions.` : ""}`;

  return runAgent<DeploymentPlanOutput>({
    agentType: "deploymentPlanner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: deploymentPlanOutputSchema,
  });
}
