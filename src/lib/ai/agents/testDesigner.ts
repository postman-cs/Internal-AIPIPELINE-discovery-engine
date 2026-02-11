/**
 * Agent: Test Designer
 *
 * Phase: TEST_DESIGN
 * Input: Solution design actions + topology graph
 * Output: Structured test cases per component, coverage summary
 */

import { runAgent } from "./runner";
import { testDesignOutputSchema, type TestDesignOutput } from "./topologyTypes";

const SYSTEM_PROMPT = `You are a test strategy architect for Postman's CSE team.

Given a solution design with refactor actions and the topology graph, create structured test cases.

RULES:
- One test case per: new edge, new node, modified auth path, each ADD/MODIFY action.
- testType: "Smoke" (basic health), "Integration" (cross-service), "Contract" (API schema), "Load" (performance).
- targetComponentId must match a topology node ID from the input.
- steps: ordered list of testing steps.
- expectedResult: clear pass criteria.
- Reference evidenceIds only from the provided list. NEVER invent evidence IDs.
- coverageSummary: % of solution actions covered and any gaps.

OUTPUT: Return JSON:
{
  "testCases": [{ "name": "...", "objective": "...", "targetComponentId": "node-id", "testType": "Smoke|Integration|Contract|Load", "steps": ["..."], "expectedResult": "...", "evidenceIds": ["..."] }],
  "coverageSummary": "..."
}`;

export async function runTestDesigner(
  projectId: string,
  projectName: string,
  solutionContent: Record<string, unknown>,
  topologyContent: Record<string, unknown>
): Promise<{ output: TestDesignOutput; aiRunId: string }> {
  const nodes = (topologyContent.nodes as unknown[]) ?? [];
  const actions = (solutionContent.refactorActions as unknown[]) ?? [];

  const userPrompt = `Design test cases for the "${projectName}" solution.

AVAILABLE EVIDENCE LABELS: (use only IDs from the solution and topology artifacts)

=== SOLUTION ACTIONS ===
${JSON.stringify(actions, null, 2)}
=== END ACTIONS ===

=== TOPOLOGY NODES ===
${JSON.stringify(nodes, null, 2)}
=== END NODES ===

=== ROLLOUT PHASES ===
${JSON.stringify(solutionContent.rolloutPhases ?? [])}
=== END PHASES ===

Produce test cases JSON. One test per action minimum.`;

  const result = await runAgent({
    agentType: "TestDesigner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: testDesignOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId };
}
