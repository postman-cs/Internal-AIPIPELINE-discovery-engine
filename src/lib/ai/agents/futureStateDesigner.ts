/**
 * Agent: Future State Designer
 *
 * Phase: DESIRED_FUTURE_STATE
 * Input: Current topology + Discovery maturity/hypothesis + evidence
 * Output: Target topology with delta summary
 */

import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";
import { runAgent } from "./runner";
import { futureStateOutputSchema, type FutureStateOutput, type AssumptionItem, type BlockerDetection } from "./topologyTypes";

const SYSTEM_PROMPT = `You are an API architecture strategist for Postman's CSE team.

Given a customer's current topology and discovery findings, design the desired future state architecture after Postman adoption.

NODE/EDGE TYPES: Same as current topology (SERVICE, API, GATEWAY, etc.).

RULES:
- Reuse existing node IDs where the component stays. Create new IDs for new components.
- Cite evidenceIds for every architectural recommendation. NEVER invent evidence IDs.
- deltaSummary must explain: nodes added, nodes removed, nodes modified, edges changed.
- recommendedPatterns: list specific patterns (e.g., "API Gateway consolidation", "Contract-first design").
- Only recommend changes that Postman's platform can facilitate.

OUTPUT: Return JSON:
{
  "targetNodes": [{ "id": "...", "type": "...", "name": "...", "metadata": {}, "evidenceIds": [...], "confidence": "..." }],
  "targetEdges": [{ "from": "...", "to": "...", "type": "...", "evidenceIds": [...], "confidence": "..." }],
  "deltaSummary": "...",
  "recommendedPatterns": ["..."],
  "evidenceIds": ["..."]
}`;

export async function runFutureStateDesigner(
  projectId: string,
  projectName: string,
  currentTopologyContent: Record<string, unknown>,
  discoveryContent: Record<string, unknown>
): Promise<{ output: FutureStateOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    `${projectName} API strategy modernization goals`,
    `${projectName} pain points developer experience improvement`,
    `${projectName} Postman adoption API governance`,
  ], 5);

  const evidenceBlock = formatEvidenceForPrompt(evidence);
  const availableLabels = evidence.map((e) => e.evidenceLabel).join(", ");

  const maturity = discoveryContent.maturity ?? {};
  const hypothesis = discoveryContent.hypothesis ?? {};

  const userPrompt = `Design the desired future state for "${projectName}".

AVAILABLE EVIDENCE LABELS (use ONLY these): ${availableLabels}

=== CURRENT TOPOLOGY ===
${JSON.stringify(currentTopologyContent, null, 2)}
=== END TOPOLOGY ===

=== DISCOVERY CONTEXT ===
Maturity: ${JSON.stringify(maturity)}
Hypothesis: ${JSON.stringify(hypothesis)}
=== END DISCOVERY ===

=== EVIDENCE ===
${evidenceBlock}
=== END EVIDENCE ===

Produce the future state topology JSON with delta summary.`;

  const result = await runAgent({
    agentType: "FutureStateDesigner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: futureStateOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
