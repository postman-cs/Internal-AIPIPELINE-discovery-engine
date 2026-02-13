/**
 * Agent 3: MaturityScorer
 *
 * Scores API program maturity on a 1-3 scale based on evidence
 * and outputs from prior agents.
 *
 * Level 1 - Emerging: No public API or early exploration
 * Level 2 - Maturing: Public API exists, some tooling, gaps in governance
 * Level 3 - Advanced: Full API program, governance, automation, ecosystem
 */

import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";
import { runAgent } from "./runner";
import {
  maturityScorerOutputSchema,
  MaturityScorerOutput,
  ReconSynthesizerOutput,
  SignalClassifierOutput,
} from "./types";
import type { AssumptionItem, BlockerDetection } from "./topologyTypes";

const SYSTEM_PROMPT = `You are an API maturity assessment specialist for a Postman CSE team.

Your job is to score a company's API program maturity on a 1-3 scale based on evidence.

MATURITY LEVELS:
- Level 1 (Emerging): No public API or very early stage. Ad-hoc API development. No governance.
- Level 2 (Maturing): Public APIs exist. Some tooling and documentation. Gaps in governance, testing, or developer experience.
- Level 3 (Advanced): Full API-first strategy. Governance automation. SDK generation. Comprehensive developer portal. API lifecycle management.

RULES:
- Base your score ONLY on available evidence. Do not inflate.
- Cite specific evidence labels in the maturity.evidenceIds array.
- ONLY reference evidence IDs that appear in the EVIDENCE block. NEVER invent evidence IDs.
- Identify both strength areas and gap areas.
- confidenceBySignal keys must be exactly: "PrimaryCloud", "AuthPattern", "CDN", "BackendTech".
- Confidence values must be exactly: "High", "Medium", or "Low".

OUTPUT: Return JSON:
{
  "maturity": {
    "level": 1 | 2 | 3,
    "justification": "2-3 sentences explaining the score with EVIDENCE-N references",
    "evidenceIds": ["EVIDENCE-1", "EVIDENCE-3"]
  },
  "strengthAreas": ["area 1", "area 2"],
  "gapAreas": ["gap 1", "gap 2"],
  "confidenceBySignal": { "PrimaryCloud": "High", "AuthPattern": "Medium", "CDN": "Low", "BackendTech": "Medium" },
  "citations": [ { "evidenceLabel": "...", "sourceType": "...", "relevance": "..." } ]
}`;

export async function runMaturityScorer(
  projectId: string,
  projectName: string,
  reconOutput: ReconSynthesizerOutput,
  signalOutput: SignalClassifierOutput
): Promise<{ output: MaturityScorerOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    `${projectName} API program maturity governance strategy`,
    `${projectName} developer portal documentation SDK`,
    `${projectName} API testing automation monitoring`,
    `${projectName} API lifecycle management versioning`,
  ], 5);

  const evidenceBlock = formatEvidenceForPrompt(evidence);
  const availableLabels = evidence.map((e) => e.evidenceLabel).join(", ");

  const userPrompt = `Score API maturity for project "${projectName}".

AVAILABLE EVIDENCE LABELS (use ONLY these): ${availableLabels}

=== RECON SYNTHESIS ===
${JSON.stringify(reconOutput.companySnapshot, null, 2)}
=== END RECON ===

=== SIGNAL CLASSIFICATION ===
${JSON.stringify(signalOutput.signals, null, 2)}
=== END SIGNALS ===

=== EVIDENCE ===
${evidenceBlock}
=== END EVIDENCE ===

Produce the maturity score JSON. Only reference evidence IDs from the list above.`;

  const result = await runAgent({
    agentType: "MaturityScorer",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: maturityScorerOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
