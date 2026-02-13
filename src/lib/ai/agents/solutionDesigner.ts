/**
 * Agent: Solution Designer
 *
 * Phase: SOLUTION_DESIGN
 * Input: Current topology + future state delta + discovery findings
 * Output: Refactor actions mapped to topology node IDs, rollout phases, risks
 */

import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";
import { runAgent } from "./runner";
import { solutionDesignOutputSchema, type SolutionDesignOutput, type AssumptionItem, type BlockerDetection } from "./topologyTypes";

const SYSTEM_PROMPT = `You are a solution architect for Postman's CSE team.

Given the gap between current and desired topology, design specific refactor actions.

RULES:
- Each action must reference a targetComponent matching a topology node ID.
- Action types: ADD (new component), REMOVE (decommission), MODIFY (change behavior).
- impactAnalysis explains downstream effects.
- rolloutPhases: ordered phases (e.g., "Phase 1: API Gateway setup", "Phase 2: Auth migration").
- risks: list technical and organizational risks.
- Cite evidenceIds. NEVER invent evidence IDs.

OUTPUT: Return JSON:
{
  "refactorActions": [{ "actionType": "ADD|REMOVE|MODIFY", "targetComponent": "node-id", "description": "...", "impactAnalysis": "...", "evidenceIds": [...], "confidence": "..." }],
  "rolloutPhases": ["Phase 1: ...", "Phase 2: ..."],
  "risks": ["..."]
}`;

export async function runSolutionDesigner(
  projectId: string,
  projectName: string,
  currentTopologyContent: Record<string, unknown>,
  futureStateContent: Record<string, unknown>,
  discoveryContent: Record<string, unknown>
): Promise<{ output: SolutionDesignOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    `${projectName} API migration refactoring strategy`,
    `${projectName} infrastructure change management risks`,
  ], 5);

  const evidenceBlock = formatEvidenceForPrompt(evidence);
  const availableLabels = evidence.map((e) => e.evidenceLabel).join(", ");

  const userPrompt = `Design the solution to move "${projectName}" from current to desired state.

AVAILABLE EVIDENCE LABELS (use ONLY these): ${availableLabels}

=== CURRENT TOPOLOGY ===
Nodes: ${JSON.stringify((currentTopologyContent.nodes as unknown[])?.slice(0, 20) ?? [])}
=== END CURRENT ===

=== DESIRED FUTURE STATE ===
Delta: ${(futureStateContent.deltaSummary as string) ?? "N/A"}
Target Nodes: ${JSON.stringify((futureStateContent.targetNodes as unknown[])?.slice(0, 20) ?? [])}
Patterns: ${JSON.stringify(futureStateContent.recommendedPatterns ?? [])}
=== END FUTURE ===

=== DISCOVERY ===
Maturity: ${JSON.stringify(discoveryContent.maturity ?? {})}
Hypothesis: ${JSON.stringify(discoveryContent.hypothesis ?? {})}
=== END DISCOVERY ===

=== EVIDENCE ===
${evidenceBlock}
=== END EVIDENCE ===

Produce the solution design JSON.`;

  const result = await runAgent({
    agentType: "SolutionDesigner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: solutionDesignOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
