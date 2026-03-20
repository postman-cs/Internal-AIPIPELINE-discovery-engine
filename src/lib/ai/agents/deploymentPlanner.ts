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

const SYSTEM_PROMPT = `You are a senior Success Captain (CSE) at Postman building a deployment plan for a customer's API platform transformation.

TASK: Given the test solution results, craft solution implementation plan, current topology, and discovery context, produce a structured deployment plan with CI/CD pipeline stages and environment promotion gates.

RULES:
- Every deployment step must cite at least one evidenceId from the provided evidence in brackets like [EVIDENCE-1].
- If you are uncertain about a claim, set confidence to "Low" and explain what needs validation.
- Deployment steps must be ordered logically (dependencies first).
- Each step must have a rollback plan.
- Training requirements must target specific audiences.
- Go-live criteria must be measurable.
- Do NOT hallucinate evidence IDs. Only use evidence IDs from the provided context.
- Return strict JSON matching the schema exactly.

CI/CD DEPLOYMENT STAGES:
- ciCdStages: for each major deployment step, generate CI/CD pipeline stage definitions for the platforms relevant to the customer's infrastructure. Infer platforms from the evidence and topology. Common platforms include GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure DevOps, AWS CodePipeline, Bitbucket Pipelines, Tekton, and others. Each stage should have:
  - stageName: descriptive stage name (e.g. "api-contract-tests", "deploy-staging", "smoke-tests-production")
  - platform: slug identifier (e.g. "github_actions", "circleci", "azure_devops")
  - platformLabel: human-readable name (e.g. "GitHub Actions", "CircleCI")
  - configLanguage: the syntax of the config snippet (e.g. "yaml", "groovy", "hcl", "toml", "json")
  - triggerCondition: when this stage runs (e.g. "on push to main", "after staging-deploy succeeds", "manual approval")
  - configSnippet: the actual config snippet for this stage in the platform's native syntax
  - gateChecks: what must pass before proceeding (e.g. "Newman contract tests pass", "Postman monitors green for 15min")
  If the evidence does not indicate specific platforms, default to GitHub Actions, GitLab CI, and Jenkins.

ENVIRONMENT PROMOTION GATES:
- environmentPromotionGates: define promotion rules between environments (dev->staging->production). Each gate should specify:
  - fromEnv / toEnv: the environment names
  - requiredChecks: list of checks that must pass (Newman test suites, Postman monitor results, manual approvals)
  - approvalRequired: whether human approval is needed
  - newmanSuiteRef: which Newman run config must pass (references configs from CRAFT_SOLUTION)

POSTMAN MONITOR AS DEPLOYMENT GATE (Feature #20):
- For production promotion gates, include Postman Monitor health checks as required checks.
- Pattern: "Postman monitor {monitorName} must report healthy for 3 consecutive runs (15 min) before promotion"
- Include in requiredChecks: "monitor-healthy: {monitorName}"
- If monitor goes red after promotion, trigger rollback automatically.

CONTRACT TEST GATES (Feature #19):
- Include contract test stages as mandatory gates before any environment promotion.
- Contract tests validate API response schemas against the expected contract.
- If contract tests fail, block promotion and alert the team.`;

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
