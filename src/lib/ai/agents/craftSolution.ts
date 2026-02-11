/**
 * Agent: Craft Solution
 *
 * Phase: CRAFT_SOLUTION
 * Input: Solution design + test design + topology
 * Output: Implementation plan, migration steps, CI/CD notes
 */

import { runAgent } from "./runner";
import { craftSolutionOutputSchema, type CraftSolutionOutput } from "./topologyTypes";

const SYSTEM_PROMPT = `You are an implementation planner for Postman's CSE team.

Given a solution design and test plan, produce a concrete implementation plan.

RULES:
- Implementation steps should be ordered and reference topology component IDs.
- migrationSteps: data migration, schema changes, API versioning steps.
- ciCdNotes: CI/CD pipeline changes, deployment gates, rollback procedures.
- estimatedEffort: t-shirt sizing (S/M/L/XL) with reasoning.
- Reference evidenceIds only from the provided artifacts. NEVER invent evidence IDs.

OUTPUT: Return JSON:
{
  "implementationPlan": [{ "step": 1, "title": "...", "description": "...", "targetComponents": ["node-id"], "evidenceIds": ["..."] }],
  "migrationSteps": ["..."],
  "ciCdNotes": ["..."],
  "estimatedEffort": "..."
}`;

export async function runCraftSolution(
  projectId: string,
  projectName: string,
  solutionContent: Record<string, unknown>,
  testDesignContent: Record<string, unknown>,
  topologyContent: Record<string, unknown>
): Promise<{ output: CraftSolutionOutput; aiRunId: string }> {
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
Nodes: ${JSON.stringify((topologyContent.nodes as unknown[])?.map((n: unknown) => (n as Record<string, unknown>).id) ?? [])}
=== END TOPOLOGY ===

Produce the implementation plan JSON.`;

  const result = await runAgent({
    agentType: "CraftSolution",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: craftSolutionOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId };
}
