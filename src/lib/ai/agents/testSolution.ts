/**
 * Agent: Test Solution
 *
 * Phase: TEST_SOLUTION
 * Input: Craft solution plan + test design + topology
 * Output: Test execution sequence, rollback triggers, monitoring hooks
 */

import { runAgent } from "./runner";
import { testSolutionOutputSchema, type TestSolutionOutput } from "./topologyTypes";

const SYSTEM_PROMPT = `You are a test execution planner for Postman's CSE team.

Given an implementation plan and test cases, produce a test execution strategy.

RULES:
- executionSequence: ordered test runs with prerequisites and estimated durations.
- rollbackTriggers: conditions that should halt deployment, with severity levels.
- monitoringHooks: metrics to watch during/after deployment.
- overallReadiness: assessment of whether the solution is ready for production.
- Be specific to the customer's topology and solution design.

OUTPUT: Return JSON:
{
  "executionSequence": [{ "order": 1, "testCaseName": "...", "prerequisites": ["..."], "estimatedDuration": "..." }],
  "rollbackTriggers": [{ "condition": "...", "action": "...", "severity": "Critical|High|Medium|Low" }],
  "monitoringHooks": [{ "metric": "...", "threshold": "...", "alertAction": "..." }],
  "overallReadiness": "..."
}`;

export async function runTestSolution(
  projectId: string,
  projectName: string,
  craftContent: Record<string, unknown>,
  testDesignContent: Record<string, unknown>
): Promise<{ output: TestSolutionOutput; aiRunId: string }> {
  const userPrompt = `Plan test execution for "${projectName}".

=== IMPLEMENTATION PLAN ===
${JSON.stringify(craftContent.implementationPlan ?? [], null, 2)}
Migration: ${JSON.stringify(craftContent.migrationSteps ?? [])}
=== END PLAN ===

=== TEST CASES ===
${JSON.stringify(testDesignContent.testCases ?? [], null, 2)}
Coverage: ${(testDesignContent.coverageSummary as string) ?? "N/A"}
=== END CASES ===

Produce the test execution JSON.`;

  const result = await runAgent({
    agentType: "TestSolution",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: testSolutionOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId };
}
