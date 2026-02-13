/**
 * Agent 1: ReconSynthesizer
 *
 * Synthesizes raw reconnaissance data into a structured company snapshot
 * and technical findings. Uses evidence retrieval to ground outputs.
 */

import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";
import { runAgent } from "./runner";
import { reconSynthesizerOutputSchema, ReconSynthesizerOutput } from "./types";
import type { AssumptionItem, BlockerDetection } from "./topologyTypes";

const SYSTEM_PROMPT = `You are a technical reconnaissance analyst for a Postman Customer Success Engineering team.

Your job is to synthesize raw intelligence data into a structured company snapshot and technical findings.

RULES:
- Only make claims supported by the provided evidence. Cite evidence labels like EVIDENCE-1.
- If information is not available in evidence, say "Unknown" or "Not observed".
- Confidence must be "High" (multiple corroborating sources), "Medium" (single clear source), or "Low" (inferred/indirect).
- Be precise and technical. No marketing language.
- ONLY reference evidence IDs that appear in the EVIDENCE block provided to you. Never invent evidence IDs.
- Every evidenceIds array must contain ONLY labels from the provided evidence block (e.g. "EVIDENCE-1").

OUTPUT: Return a JSON object with this exact structure:
{
  "companySnapshot": {
    "industry": "string",
    "engineeringSize": "string (estimate)",
    "publicApiPresence": "Yes" | "No" | "Partial",
    "summary": "2-3 sentence company overview",
    "evidenceIds": ["EVIDENCE-1", "EVIDENCE-3"]
  },
  "technicalFindings": [
    {
      "signal": "e.g. Primary Cloud",
      "finding": "specific finding",
      "evidence": "what was observed",
      "confidence": "High" | "Medium" | "Low",
      "evidenceIds": ["EVIDENCE-1"]
    }
  ],
  "publicFootprint": {
    "postmanNetwork": "summary of Postman presence",
    "developerPortal": "developer portal status",
    "githubPresence": "GitHub activity summary",
    "evidenceIds": ["EVIDENCE-2"]
  },
  "citations": [
    { "evidenceLabel": "EVIDENCE-1", "sourceType": "DNS", "relevance": "why it matters" }
  ]
}`;

export async function runReconSynthesizer(
  projectId: string,
  projectName: string
): Promise<{ output: ReconSynthesizerOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
  // Retrieve evidence with multiple reconnaissance-focused queries
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    `${projectName} company overview industry engineering team size`,
    `${projectName} API presence public workspace developer portal`,
    `${projectName} cloud infrastructure CDN authentication technology stack`,
    `${projectName} DNS findings HTTP headers technical signals`,
    `${projectName} GitHub engineering presence repositories`,
  ], 5);

  const evidenceBlock = formatEvidenceForPrompt(evidence);
  const availableLabels = evidence.map((e) => e.evidenceLabel).join(", ");

  const userPrompt = `Analyze the following evidence for project "${projectName}" and produce a reconnaissance synthesis.

AVAILABLE EVIDENCE LABELS (use ONLY these): ${availableLabels}

=== EVIDENCE ===
${evidenceBlock}
=== END EVIDENCE ===

Produce the structured JSON output. Only reference evidence IDs from the list above.`;

  const result = await runAgent({
    agentType: "ReconSynthesizer",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: reconSynthesizerOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
