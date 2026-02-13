/**
 * Agent 2: SignalClassifier
 *
 * Takes raw reconnaissance data and classifies it into canonical
 * technical landscape signals using the DiscoverySignal schema:
 * { signalType, finding, evidenceIds, confidence, reasoning }
 */

import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";
import { runAgent } from "./runner";
import { signalClassifierOutputSchema, SignalClassifierOutput, ReconSynthesizerOutput } from "./types";
import type { AssumptionItem, BlockerDetection } from "./topologyTypes";

const SYSTEM_PROMPT = `You are a technical signal classifier for a Postman CSE team.

Your job is to classify raw evidence into standardized technical landscape signals.
You receive both raw evidence AND the output from a prior ReconSynthesizer agent.

REQUIRED SIGNALS (produce exactly these four signalType values):
1. "PrimaryCloud" - AWS, GCP, Azure, or other
2. "CDN" - CloudFront, Cloudflare, Akamai, Fastly, or other
3. "AuthPattern" - OAuth2, API Key, JWT, SAML, custom, etc.
4. "BackendTech" - Node.js, Python, Java, Go, .NET, etc.

RULES:
- Each signal must use the exact signalType enum: "PrimaryCloud", "AuthPattern", "CDN", "BackendTech".
- evidenceIds must ONLY contain labels from the provided evidence (e.g. "EVIDENCE-1"). NEVER invent evidence IDs.
- confidence: "High" = multiple sources, "Medium" = single clear source, "Low" = inferred.
- If a signal is unknown, set finding to "Not observed" and confidence to "Low".
- reasoning explains HOW you arrived at the finding from the evidence.

OUTPUT: Return JSON:
{
  "signals": [
    { "signalType": "PrimaryCloud", "finding": "AWS (EC2 + S3 detected)", "evidenceIds": ["EVIDENCE-1"], "confidence": "High", "reasoning": "Multiple DNS records point to AWS infrastructure" },
    { "signalType": "CDN", "finding": "CloudFront", "evidenceIds": ["EVIDENCE-2"], "confidence": "Medium", "reasoning": "CDN headers detected in HTTP response" },
    { "signalType": "AuthPattern", "finding": "OAuth2 + API Key", "evidenceIds": ["EVIDENCE-3"], "confidence": "High", "reasoning": "OAuth2 flow documented in developer portal" },
    { "signalType": "BackendTech", "finding": "Node.js + Python", "evidenceIds": [], "confidence": "Low", "reasoning": "Inferred from job postings and GitHub repos" }
  ],
  "citations": [ { "evidenceLabel": "EVIDENCE-1", "sourceType": "DNS", "relevance": "why it matters" } ]
}`;

export async function runSignalClassifier(
  projectId: string,
  projectName: string,
  reconOutput: ReconSynthesizerOutput
): Promise<{ output: SignalClassifierOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    `${projectName} cloud provider AWS GCP Azure infrastructure`,
    `${projectName} CDN edge network CloudFront Cloudflare`,
    `${projectName} authentication OAuth API key JWT token`,
    `${projectName} backend technology framework language`,
  ], 5);

  const evidenceBlock = formatEvidenceForPrompt(evidence);
  const availableLabels = evidence.map((e) => e.evidenceLabel).join(", ");

  const userPrompt = `Classify technical signals for project "${projectName}".

AVAILABLE EVIDENCE LABELS (use ONLY these): ${availableLabels}

=== PRIOR RECON OUTPUT ===
${JSON.stringify(reconOutput, null, 2)}
=== END RECON ===

=== EVIDENCE ===
${evidenceBlock}
=== END EVIDENCE ===

Produce exactly 4 signals with signalType values: "PrimaryCloud", "CDN", "AuthPattern", "BackendTech".
Only reference evidence IDs from the list above.`;

  const result = await runAgent({
    agentType: "SignalClassifier",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: signalClassifierOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
