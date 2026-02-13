/**
 * Agent: Test Designer
 *
 * Phase: TEST_DESIGN
 * Input: Solution design actions + topology graph
 * Output: Structured test cases with Postman test scripts and Newman commands
 */

import { runAgent } from "./runner";
import { testDesignOutputSchema, type TestDesignOutput, type AssumptionItem, type BlockerDetection } from "./topologyTypes";

const SYSTEM_PROMPT = `You are a test strategy architect for Postman's CSE team.

Given a solution design with refactor actions and the topology graph, create structured test cases that can be executed via Postman and Newman in CI/CD pipelines.

RULES:
- One test case per: new edge, new node, modified auth path, each ADD/MODIFY action.
- testType: "Smoke" (basic health), "Integration" (cross-service), "Contract" (API schema), "Load" (performance).
- targetComponentId must match a topology node ID from the input.
- steps: ordered list of testing steps.
- expectedResult: clear pass criteria.
- Reference evidenceIds only from the provided list. NEVER invent evidence IDs.
- coverageSummary: % of solution actions covered and any gaps.

POSTMAN TEST INTEGRATION:
- postmanTestScript: for each test case, provide a concrete pm.test() JavaScript snippet that validates the expected result. Use Postman's pm.* API (pm.response, pm.expect, pm.test). Example:
  pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
  pm.test("Response has items", function () { var json = pm.response.json(); pm.expect(json.items).to.be.an('array').that.is.not.empty; });
- newmanCommand: provide the exact newman CLI command to run this test. Use format:
  newman run <collection.json> -e <env.json> --reporters cli,junit --reporter-junit-export results.xml

CONTRACT TESTING (Feature #19):
- For "Contract" type tests, generate pm.test() scripts that validate response schemas.
- Use JSON Schema validation: define the expected schema and validate with tv4 or pm.expect.
- Example:
  const schema = { type: "object", required: ["id", "name"], properties: { id: { type: "string" }, name: { type: "string" } } };
  pm.test("Response matches contract schema", function() { pm.expect(tv4.validate(pm.response.json(), schema)).to.be.true; });
- Contract tests should check: response status, content-type, required fields, field types, enum values.
- Mark contract tests as deployment gates in the newmanCommand (add --bail flag).

OUTPUT: Return JSON:
{
  "testCases": [{ "name": "...", "objective": "...", "targetComponentId": "node-id", "testType": "Smoke|Integration|Contract|Load", "steps": ["..."], "expectedResult": "...", "evidenceIds": ["..."], "postmanTestScript": "pm.test(...)", "newmanCommand": "newman run ..." }],
  "coverageSummary": "..."
}`;

export async function runTestDesigner(
  projectId: string,
  projectName: string,
  solutionContent: Record<string, unknown>,
  topologyContent: Record<string, unknown>
): Promise<{ output: TestDesignOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
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

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
