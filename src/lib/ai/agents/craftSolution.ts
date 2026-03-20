/**
 * Agent: Craft Solution
 *
 * Phase: CRAFT_SOLUTION
 * Input: Solution design + test design + topology
 * Output: Implementation plan, migration steps, CI/CD pipelines, Postman collections, Newman configs
 */

import { runAgent } from "./runner";
import { craftSolutionOutputSchema, type CraftSolutionOutput, type AssumptionItem, type BlockerDetection } from "./topologyTypes";

const SYSTEM_PROMPT = `You are an implementation planner for Postman's CSE team.

Given a solution design and test plan, produce a concrete implementation plan that helps the customer bake Postman into their CI/CD and cloud infrastructure pipelines.

RULES:
- Implementation steps should be ordered and reference topology component IDs.
- migrationSteps: data migration, schema changes, API versioning steps.
- ciCdNotes: additional CI/CD considerations as free-text notes.
- estimatedEffort: t-shirt sizing (S/M/L/XL) with reasoning.
- Reference evidenceIds only from the provided artifacts. NEVER invent evidence IDs.

POSTMAN CI/CD INTEGRATION:
- postmanCollections: generate concrete Postman collection stubs. Each collection should have folders grouping related requests by service or workflow. Requests must include method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS), name, urlPattern (with {{baseUrl}} variable), and description. Map collections to the topology components being tested.
- newmanRunConfigs: for each collection, create Newman CLI run configs for different environments (dev, staging, production). Include appropriate reporters (cli + junit for CI, htmlextra for humans). Set bailOnFailure=true for gate checks, false for smoke tests.
- ciCdPipelines: generate complete, production-quality pipeline configs for EACH CI/CD platform that is relevant to the customer's infrastructure. Infer the appropriate platforms from the topology and evidence. Common platforms include (but are not limited to):
  - GitHub Actions (.github/workflows/ YAML)
  - GitLab CI (.gitlab-ci.yml YAML)
  - Jenkins (Jenkinsfile, Groovy)
  - CircleCI (.circleci/config.yml YAML)
  - Azure DevOps (azure-pipelines.yml YAML)
  - AWS CodePipeline / CodeBuild (buildspec.yml YAML)
  - Bitbucket Pipelines (bitbucket-pipelines.yml YAML)
  - Google Cloud Build (cloudbuild.yaml YAML)
  - Tekton (YAML)
  - Drone CI (.drone.yml YAML)
  - Travis CI (.travis.yml YAML)
  - Buildkite (pipeline.yml YAML)
  For each, provide: platform (slug), platformLabel (human name), configLanguage (syntax: yaml, groovy, hcl, toml, json, etc.), filename, description, and configContent. Each pipeline should install Node.js + Newman, run the collection(s), upload test reports as artifacts, and fail the build on test failures.
  If the evidence does not indicate which CI/CD platforms the customer uses, default to GitHub Actions, GitLab CI, and Jenkins as the three most common.

CONTRACT TESTING (Feature #19):
- For "Contract" type test cases, generate Postman test scripts that validate response bodies against expected JSON schemas.
- Use pm.expect with JSON Schema assertions: pm.expect(tv4.validate(pm.response.json(), schema)).to.be.true
- Include schema definitions inline in the test script for self-contained validation.
- Mark contract test Newman configs with bailOnFailure=true (they are deployment gates).

MONITOR AS DEPLOYMENT GATE (Feature #20):
- In pipeline configs, include a step that checks Postman Monitor status before production deployment.
- Use the Postman API to poll monitor results: GET /monitors/{monitorUid}/run
- Pattern: after deploying to an environment, trigger the monitor, wait for N consecutive successes, then proceed.
- Include rollback triggers if the monitor goes red after promotion.

OUTPUT: Return JSON matching this schema exactly:
{
  "implementationPlan": [{ "step": 1, "title": "...", "description": "...", "targetComponents": ["node-id"], "evidenceIds": ["..."] }],
  "migrationSteps": ["..."],
  "ciCdNotes": ["..."],
  "estimatedEffort": "...",
  "postmanCollections": [{ "name": "...", "description": "...", "folders": [{ "name": "...", "requests": [{ "method": "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS", "name": "...", "urlPattern": "...", "description": "..." }] }] }],
  "newmanRunConfigs": [{ "name": "...", "description": "...", "collectionRef": "...", "environmentRef": "...", "reporters": ["cli","junit"], "bailOnFailure": true }],
  "ciCdPipelines": [{ "platform": "github_actions", "platformLabel": "GitHub Actions", "configLanguage": "yaml", "filename": "...", "description": "...", "configContent": "..." }]
}`;

export async function runCraftSolution(
  projectId: string,
  projectName: string,
  solutionContent: Record<string, unknown>,
  testDesignContent: Record<string, unknown>,
  topologyContent: Record<string, unknown>,
  serviceTemplateContext?: string | null
): Promise<{ output: CraftSolutionOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
  const nodes = (topologyContent.nodes as unknown[]) ?? [];

  const userPrompt = `Create the implementation plan for "${projectName}".

=== SOLUTION DESIGN ===
Actions: ${JSON.stringify(solutionContent.refactorActions ?? [])}
Rollout: ${JSON.stringify(solutionContent.rolloutPhases ?? [])}
Risks: ${JSON.stringify(solutionContent.risks ?? [])}
=== END SOLUTION ===

=== TEST DESIGN ===
Cases: ${JSON.stringify((testDesignContent.testCases as unknown[])?.length ?? 0)} test cases defined
Coverage: ${(testDesignContent.coverageSummary as string) ?? "N/A"}
=== END TESTS ===

=== TOPOLOGY ===
Nodes: ${JSON.stringify(nodes.map((n: unknown) => {
    const node = n as Record<string, unknown>;
    return { id: node.id, name: node.name, type: node.type };
  }))}
=== END TOPOLOGY ===

Generate the implementation plan JSON with complete CI/CD pipeline configs for each platform relevant to the customer's stack. Include Postman collection stubs and Newman run configs for the customer's API endpoints. If the evidence indicates specific CI/CD platforms (e.g. GitHub Actions, CircleCI, Azure DevOps), generate for those; otherwise default to the three most common (GitHub Actions, GitLab CI, Jenkins).
${serviceTemplateContext ? `\n${serviceTemplateContext}\n\nIMPORTANT: A customer service template has been provided above. Generate collections, tests, and CI/CD workflows that target the REAL endpoints and schemas defined in this template rather than hypothetical ones. Extract actual paths, methods, request/response schemas, and auth patterns from the template.` : ""}`;

  const result = await runAgent({
    agentType: "CraftSolution",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: craftSolutionOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
